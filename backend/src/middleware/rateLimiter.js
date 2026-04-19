'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Default API rate limiter — 100 requests per 15 minutes per IP.
 */
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Stricter limiter for payment endpoints — 10 requests per 15 minutes per IP.
 * Prevents M-Pesa STK push abuse.
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests, please try again later.' },
});

module.exports = { defaultLimiter, paymentLimiter };
