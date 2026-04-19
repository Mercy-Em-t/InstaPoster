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
const { errorHandler } = require('./middleware/errorHandler');
const { defaultLimiter, paymentLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Security & Logging ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));

// ── Body Parsing ──────────────────────────────────────────────────────────
// Raw body for M-Pesa callback signature verification
app.use('/api/payments/mpesa/callback', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/posts', defaultLimiter, postsRouter);
app.use('/api/products', defaultLimiter, productsRouter);
app.use('/api/t', defaultLimiter, trackingRouter);
app.use('/api/payments', paymentLimiter, paymentsRouter);
app.use('/api/webhooks', defaultLimiter, webhooksRouter);

// ── Error Handler ─────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
