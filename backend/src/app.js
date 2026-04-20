'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const postsRouter = require('./api/routes/posts.routes');
const productsRouter = require('./api/routes/products.routes');
const trackingRouter = require('./api/routes/tracking.routes');
const paymentsRouter = require('./api/routes/payments.routes');
const webhooksRouter = require('./api/routes/webhooks.routes');
const ordersRouter = require('./api/routes/orders.routes');
const analyticsRouter = require('./api/routes/analytics.routes');
const authRouter = require('./api/routes/auth.routes');
const { errorHandler } = require('./middleware/errorHandler');
const { auth, authorize } = require('./middleware/auth');
const { requestLogger } = require('./middleware/requestLogger');
const { defaultLimiter, paymentLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Security & Logging ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(requestLogger);

// ── Body Parsing ──────────────────────────────────────────────────────────
// Raw body for M-Pesa callback signature verification
app.use('/api/payments/mpesa/callback', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', defaultLimiter, authRouter);
app.use('/api/posts', defaultLimiter, auth, authorize('ADMIN', 'STAFF'), postsRouter);
app.use('/api/products', defaultLimiter, auth, authorize('ADMIN', 'STAFF'), productsRouter);
app.use('/api/t', defaultLimiter, trackingRouter);
app.use('/api/payments', paymentLimiter, auth, authorize('ADMIN', 'STAFF'), paymentsRouter);
app.use('/api/webhooks', defaultLimiter, webhooksRouter);
app.use('/api/orders', defaultLimiter, auth, authorize('ADMIN', 'STAFF'), ordersRouter);
app.use('/api/analytics', defaultLimiter, auth, authorize('ADMIN', 'STAFF', 'VIEWER'), analyticsRouter);

// ── Error Handler ─────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
