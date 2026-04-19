# InstaPoster — System Documentation

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Unified Product Views](#3-unified-product-views)
4. [API Reference](#4-api-reference)
5. [M-Pesa STK Push Flow](#5-m-pesa-stk-push-flow)
6. [Instagram Publishing Flow](#6-instagram-publishing-flow)
7. [Job Queue System](#7-job-queue-system)
8. [Frontend Dashboard](#8-frontend-dashboard)
9. [Operations Playbook](#9-operations-playbook)
10. [Environment Variables](#10-environment-variables)

---

## 1. Architecture Overview

InstaPoster is an **arm extension** of your existing shop system.

```
          [ EXISTING SHOP SYSTEM ]
        (products, inventory, orders)
                    │
        ────────────┼────────────
                    │ READ ONLY (via SQL UNION views)
                    ▼
      [ INSTAPOSTER — CONTENT-COMMERCE EXTENSION ]
   (content, tracking, Instagram automation, payments)
                    │
                    ▼
              [ INSTAGRAM ]
                    │
                    ▼
             [ CUSTOMER TRAFFIC ]
                    │
                    ▼
        [ CHECKOUT / M-Pesa PAYMENT ]
                    │
                    ▼
        [ ORDER BRIDGE → existing system webhook ]
```

### Key Design Decisions
- **No product duplication** — products are read via `unified_products` SQL UNION view
- **Order bridge pattern** — orders stay in the existing system; InstaPoster only records attribution
- **Loose coupling** — adding/removing InstaPoster does not affect existing shop operations

---

## 2. Database Schema

InstaPoster owns only these tables (managed via Prisma):

### `content_posts`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | Auto-generated |
| title | String | Internal title |
| caption | String | Instagram caption |
| status | Enum | DRAFT / SCHEDULED / POSTED / FAILED |
| scheduledAt | DateTime? | When to publish |
| postedAt | DateTime? | When it was published |
| instagramPostId | String? | IG media ID after publish |

### `content_slides`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| postId | FK → content_posts | |
| imageUrl | String | Must be a public URL accessible by Instagram |
| slideOrder | Int | 1-indexed position in carousel |
| overlayText | String? | Optional text overlay description |

### `content_products`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| postId | FK → content_posts | |
| productId | String | ID from external shop system |
| productSource | String | "main_store" or "secondary_store" |

### `tracking_links`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| postId | FK → content_posts | |
| code | String (unique) | Short code used in URLs |

### `link_clicks`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| trackingLinkId | FK → tracking_links | |
| clickedAt | DateTime | |
| ipAddress | String? | |
| userAgent | String? | |
| deviceType | String? | "mobile" / "desktop" / "tablet" |

### `orders_bridge`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| externalOrderId | String | Order ID from existing shop |
| sourceSystem | String | "main_store" / "secondary_store" |
| trackingLinkId | FK? → tracking_links | Attribution link |

### `payments`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| externalOrderId | String? | |
| amount | Float | |
| phone | String | Customer phone (Kenyan format) |
| status | Enum | PENDING / SUCCESS / FAILED / TIMEOUT |
| provider | String | Default: "mpesa" |

### `mpesa_transactions`
| Column | Type | Description |
|--------|------|-------------|
| id | cuid (PK) | |
| paymentId | FK → payments | |
| checkoutRequestId | String (unique) | From Safaricom STK push |
| merchantRequestId | String? | |
| mpesaReceiptNumber | String? | Set after successful payment |
| amount | Float? | Confirmed amount |
| status | Enum | PENDING / SUCCESS / FAILED / TIMEOUT |
| resultCode | Int? | Safaricom result code |

---

## 3. Unified Product Views

Run `backend/prisma/migrations/unified_views.sql` **once** in your shared PostgreSQL database.

### `unified_products` view
```sql
SELECT product_id, name, price, stock_quantity, image_url, description, is_active, source
FROM unified_products
WHERE is_active = TRUE AND name ILIKE '%bag%'
ORDER BY name
LIMIT 20 OFFSET 0;
```

### `unified_inventory` view
```sql
SELECT product_id, stock_quantity, reorder_level, last_updated, source
FROM unified_inventory
WHERE stock_quantity < reorder_level;
```

**Query only for what you need** — never SELECT * in production loops.

---

## 4. API Reference

Base URL: `http://localhost:3001/api`

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts` | List posts (params: page, limit, status) |
| POST | `/posts` | Create carousel post |
| GET | `/posts/:id` | Get single post |
| PATCH | `/posts/:id` | Update post |
| DELETE | `/posts/:id` | Delete post |
| POST | `/posts/:id/publish` | Publish immediately to Instagram |
| POST | `/posts/:id/schedule` | Schedule for future publishing |

#### POST /posts — Request Body
```json
{
  "title": "Home Upgrade Carousel",
  "caption": "Your space isn't missing furniture—it's missing this.",
  "imageUrls": "[\"https://cdn.example.com/img1.jpg\", \"https://cdn.example.com/img2.jpg\"]",
  "scheduledAt": "2024-12-01T09:00:00.000Z",
  "products": "[{\"productId\": \"123\", \"productSource\": \"main_store\"}]"
}
```

### Products (Read-only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List from unified_products view |
| GET | `/products/:id` | Get single product (query: ?source=main_store) |

### Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/t/:code` | Log click + redirect to shop |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/stk-push` | Initiate M-Pesa STK push |
| POST | `/payments/mpesa/callback` | Safaricom callback (webhook) |
| GET | `/payments/:id` | Get payment status |

#### POST /payments/stk-push — Request Body
```json
{
  "phone": "0712345678",
  "amount": 1500,
  "orderId": "order-abc123",
  "description": "InstaPoster Order"
}
```

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/order-created` | Bridge order from existing system |

#### POST /webhooks/order-created — Request Body
```json
{
  "order_id": "12345",
  "source": "main_store",
  "tracking_code": "abc123"
}
```

---

## 5. M-Pesa STK Push Flow

```
Customer → "Order" → Backend
                        │
                   1. Create payment record (PENDING)
                        │
                   2. Generate M-Pesa token
                        │
                   3. Send STK Push (prompt on phone)
                        │
                   4. Return 202 to customer
                        │
              ┌─────────┴─────────┐
         Customer              Safaricom
         confirms              processes
              │                     │
              └──────── callback ───┘
                              │
                   5. Parse callback
                        │
                   6. If ResultCode == 0:
                      → Update tx: SUCCESS
                      → Update payment: SUCCESS
                      → Log receipt number
                        │
                   7. If failed/timeout:
                      → Update tx: FAILED/TIMEOUT
                      → Optionally retry (PaymentRetry job)
```

### Retry Logic
- `PaymentRetry` job retries failed STK pushes up to **3 times**
- Delays: 2min → 4min → 8min (exponential backoff)
- `PaymentMonitor` job runs every **2 minutes** to time out pending transactions older than 5 minutes

---

## 6. Instagram Publishing Flow

Requires:
- Instagram Business Account connected to a Facebook Page
- Meta App with `instagram_content_publish` permission
- Long-lived access token (`META_ACCESS_TOKEN`)

```
1. Upload each image → individual container ID
   POST /{account_id}/media
   { image_url, is_carousel_item: true }

2. Wait for each container status == FINISHED

3. Create carousel container
   POST /{account_id}/media
   { media_type: CAROUSEL, children: [id1,id2,...], caption }

4. Wait for carousel container status == FINISHED

5. Publish
   POST /{account_id}/media_publish
   { creation_id: carousel_id }
   → Returns Instagram post ID
```

**Image requirements:**
- Must be a publicly accessible HTTPS URL
- Recommended: 1080×1080 px (square) or 1080×1350 px (portrait)
- Max 10 images per carousel, min 2

---

## 7. Job Queue System

Uses **BullMQ + Redis**.

| Queue | Trigger | Description |
|-------|---------|-------------|
| `post-publisher` | On schedule (delayed job) | Publishes carousel to Instagram |
| `payment-monitor` | Every 2 minutes | Times out stale M-Pesa transactions |
| `payment-retry` | Delayed (exponential) | Retries failed STK pushes |
| `analytics` | Every hour | Aggregates clicks + conversions |

### Starting workers
Workers start automatically when the server starts (`initQueues()` in `server.js`).

In production, run workers as separate processes:
```bash
node src/jobs/worker.js
```

---

## 8. Frontend Dashboard

React + Vite + Tailwind CSS

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview stats + recent posts |
| Content Manager | `/content` | Create, view, publish, delete carousels |
| Scheduler | `/schedule` | Schedule posts to publish at specific times |
| Products | `/products` | Browse unified product view (read-only) |
| Analytics | `/analytics` | Published posts, tracking links, conversion data |

```bash
cd frontend
npm run dev    # http://localhost:5173
npm run build  # production build
```

---

## 9. Operations Playbook

### Daily
1. Check scheduler for posts going live today
2. Verify no payment timeouts (check `payments` table: status = TIMEOUT)
3. Review Instagram for post performance

### Weekly
1. Review analytics: top posts by clicks
2. Review top-selling products (via existing system)
3. Replenish content pipeline (create 3–5 new carousels)

### Failure Handling

| Issue | Action |
|-------|--------|
| Post status = FAILED | Check `instagramPostId` is null; verify Meta token not expired; retry via POST `/posts/:id/publish` |
| Payment TIMEOUT | Check Safaricom dashboard; verify callback URL is reachable; re-trigger STK push via retry |
| Unified view returns 0 rows | Check DB connection; verify `unified_products` view exists; check source table column names |
| Redis not available | Queued jobs won't run; posting must be done manually; check Redis connection |

### Key Monitoring Queries
```sql
-- Stale pending payments (older than 10 minutes)
SELECT * FROM payments
WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '10 minutes';

-- Failed posts
SELECT id, title, updated_at FROM content_posts WHERE status = 'FAILED';

-- Top tracking links by clicks (last 7 days)
SELECT tracking_link_id, COUNT(*) as clicks
FROM link_clicks
WHERE clicked_at > NOW() - INTERVAL '7 days'
GROUP BY tracking_link_id
ORDER BY clicks DESC;
```

---

## 10. Environment Variables

See `backend/.env.example` for the full list.

**Critical variables:**
- `DATABASE_URL` — PostgreSQL connection for InstaPoster tables + unified views
- `META_ACCESS_TOKEN` — Long-lived Instagram Graph API token
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` — Your IG Business account ID
- `MPESA_CONSUMER_KEY` + `MPESA_CONSUMER_SECRET` — Daraja API credentials
- `MPESA_PASSKEY` — STK push passkey from Safaricom
- `MPESA_CALLBACK_URL` — Must be a publicly reachable HTTPS URL
- `REDIS_URL` — Redis connection for BullMQ

---

*InstaPoster v1.0.0 — Built for handover to development team*
