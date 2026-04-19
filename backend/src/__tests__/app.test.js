'use strict';

/**
 * App-level integration tests
 * Uses supertest to test the Express app routes without a real DB or Redis.
 *
 * Prisma and BullMQ are mocked so tests run without external dependencies.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock Prisma
jest.mock('../db/prisma', () => ({
  contentPost: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contentSlide: { create: jest.fn() },
  contentProduct: { create: jest.fn() },
  trackingLink: { findUnique: jest.fn() },
  linkClick: { create: jest.fn() },
  orderBridge: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  payment: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  mpesaTransaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
}));

// Mock BullMQ queue (so initQueues is a no-op in tests)
jest.mock('../jobs/queue', () => ({
  initQueues: jest.fn().mockResolvedValue(undefined),
  addPostPublishJob: jest.fn().mockResolvedValue(undefined),
  addPaymentRetryJob: jest.fn().mockResolvedValue(undefined),
  QUEUE_NAMES: {},
}));

// Mock M-Pesa service
jest.mock('../services/mpesa.service', () => ({
  initiateSTKPush: jest.fn(),
  parseCallback: jest.fn(),
  normalizePhone: jest.fn((p) => p),
}));

// Mock Instagram service
jest.mock('../services/instagram.service', () => ({
  publishCarousel: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const prisma = require('../db/prisma');

beforeEach(() => jest.clearAllMocks());

// ── Health ──────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

// ── Posts ───────────────────────────────────────────────────────────────────

describe('POST /api/posts', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({ caption: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.requestId).toBeDefined();
  });

  it('returns 400 when caption is missing', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({ title: 'Test' });
    expect(res.status).toBe(400);
  });

  it('creates a post and returns 201', async () => {
    prisma.contentPost.create.mockResolvedValue({
      id: 'post-1',
      title: 'Test',
      caption: 'Caption',
      status: 'DRAFT',
      slides: [],
      contentProducts: [],
      trackingLinks: [{ code: 'abc123' }],
    });

    const res = await request(app)
      .post('/api/posts')
      .send({ title: 'Test', caption: 'Caption' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('post-1');
  });
});

describe('GET /api/posts', () => {
  it('returns paginated list of posts', async () => {
    prisma.contentPost.findMany.mockResolvedValue([]);
    prisma.contentPost.count.mockResolvedValue(0);

    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });
});

describe('GET /api/posts/:id', () => {
  it('returns 404 when post not found', async () => {
    prisma.contentPost.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/posts/unknown-id');
    expect(res.status).toBe(404);
  });

  it('returns the post when found', async () => {
    prisma.contentPost.findUnique.mockResolvedValue({
      id: 'post-1',
      title: 'Test',
      slides: [],
      contentProducts: [],
      trackingLinks: [],
    });
    const res = await request(app).get('/api/posts/post-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('post-1');
  });
});

// ── Payments ────────────────────────────────────────────────────────────────

describe('POST /api/payments/stk-push', () => {
  it('returns 400 when required fields missing', async () => {
    const res = await request(app).post('/api/payments/stk-push').send({ phone: '0712345678' });
    expect(res.status).toBe(400);
  });

  it('returns 202 on successful STK push', async () => {
    prisma.payment.create.mockResolvedValue({ id: 'pay-1', phone: '254712345678', amount: 500 });
    prisma.mpesaTransaction.create.mockResolvedValue({ id: 'tx-1' });

    const mpesaService = require('../services/mpesa.service');
    mpesaService.initiateSTKPush.mockResolvedValue({
      checkoutRequestId: 'checkout-1',
      merchantRequestId: 'merchant-1',
    });

    const res = await request(app)
      .post('/api/payments/stk-push')
      .send({ phone: '0712345678', amount: 500, orderId: 'order-1' });

    expect(res.status).toBe(202);
    expect(res.body.paymentId).toBe('pay-1');
  });
});

describe('GET /api/payments', () => {
  it('returns payments monitor list', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);

    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });
});

describe('POST /api/payments/:id/retry', () => {
  it('queues retry for failed payment', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'FAILED',
      mpesaTransaction: { id: 'tx-1' },
    });

    const res = await request(app).post('/api/payments/pay-1/retry').send({ attempt: 0 });
    expect(res.status).toBe(202);
    expect(res.body.paymentId).toBe('pay-1');
  });
});

// ── Tracking ────────────────────────────────────────────────────────────────

describe('GET /api/t/:code', () => {
  it('returns 404 for unknown tracking code', async () => {
    prisma.trackingLink.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/t/BADCODE');
    expect(res.status).toBe(404);
  });

  it('redirects to shop URL for valid code', async () => {
    prisma.trackingLink.findUnique.mockResolvedValue({
      id: 'link-1',
      code: 'ABC123',
      post: { id: 'post-1' },
    });
    prisma.linkClick.create.mockResolvedValue({});

    const res = await request(app).get('/api/t/ABC123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('ABC123');
  });
});

// ── Webhooks ────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/order-created', () => {
  it('returns 400 when order_id is missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/order-created')
      .send({ source: 'main_store' });
    expect(res.status).toBe(400);
  });

  it('creates an order bridge record', async () => {
    prisma.trackingLink.findUnique.mockResolvedValue(null);
    prisma.orderBridge.create.mockResolvedValue({
      id: 'bridge-1',
      externalOrderId: '999',
      sourceSystem: 'main_store',
    });

    const res = await request(app)
      .post('/api/webhooks/order-created')
      .send({ order_id: '999', source: 'main_store' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('bridge-1');
  });
});

describe('GET /api/orders', () => {
  it('returns bridged orders with payment info', async () => {
    prisma.orderBridge.findMany.mockResolvedValue([
      {
        id: 'bridge-1',
        externalOrderId: '123',
        sourceSystem: 'main_store',
        createdAt: new Date().toISOString(),
        trackingLink: { code: 'abc123', post: { id: 'post-1', title: 'My Post', instagramPostId: null } },
      },
    ]);
    prisma.orderBridge.count.mockResolvedValue(1);
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', externalOrderId: '123', status: 'SUCCESS', amount: 500, mpesaTransaction: { status: 'SUCCESS' } },
    ]);

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].paymentStatus).toBe('SUCCESS');
  });
});

describe('GET /api/analytics/posts', () => {
  it('returns post analytics metrics', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { postId: 'post-1', title: 'Post', status: 'POSTED', postedAt: null, clicks: 10, sales: 2, conversionRate: 20 },
    ]);

    const res = await request(app).get('/api/analytics/posts');
    expect(res.status).toBe(200);
    expect(res.body.summary.totalClicks).toBe(10);
    expect(res.body.summary.totalSales).toBe(2);
  });
});
