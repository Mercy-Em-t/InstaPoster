# InstaPoster

Content-commerce platform for Instagram posting, tracking, order bridge, and M-Pesa payment monitoring.

## Run locally

```bash
npm install
npm run dev -w backend
npm run dev -w frontend
```

## Dashboard auth

- Login endpoint: `POST /api/auth/login`
- Default dev users (unless `DASHBOARD_USERS` is configured):
  - `admin@local / admin123` (ADMIN)
  - `staff@local / staff123` (STAFF)
  - `viewer@local / viewer123` (VIEWER)

## Real-time updates

- WebSocket endpoint: `ws://<host>/ws`
- Events: `payment:updated`, `order:created`, `post:published`, plus post lifecycle events.

## Production deployment

- Docker compose: `/docker-compose.prod.yml`
- Nginx config: `/deploy/nginx/instaposter.conf`
- VPS setup script: `/deploy/scripts/vps-setup.sh`
- CI/CD workflow: `/.github/workflows/deploy.yml`
