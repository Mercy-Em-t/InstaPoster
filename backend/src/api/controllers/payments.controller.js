'use strict';

/**
 * Payments Controller — M-Pesa STK Push
 *
 * Endpoints:
 *   POST /api/payments/stk-push        — initiate STK push
 *   POST /api/payments/mpesa/callback  — receive Safaricom callback
 *   GET  /api/payments                 — list payments monitor data
 *   GET  /api/payments/:id             — get single payment status
 *   POST /api/payments/:id/retry       — enqueue payment retry
 */

const prisma = require('../../db/prisma');
const mpesaService = require('../../services/mpesa.service');
const { addPaymentRetryJob } = require('../../jobs/queue');
const { createError } = require('../../middleware/errorHandler');
const { broadcast } = require('../../realtime/ws');

const MAX_RETRY_ATTEMPTS = 3;

/**
 * POST /api/payments/stk-push
 * Body: { phone, amount, orderId, description? }
 */
async function initiatePayment(req, res, next) {
  try {
    const { phone, amount, orderId, description } = req.body;

    if (!phone || !amount || !orderId) {
      return next(createError(400, 'phone, amount, and orderId are required'));
    }

    if (amount <= 0) return next(createError(400, 'amount must be greater than 0'));

    // Create payment record first
    const payment = await prisma.payment.create({
      data: {
        externalOrderId: String(orderId),
        amount: parseFloat(amount),
        phone: String(phone),
        status: 'PENDING',
      },
    });

    // Trigger STK push
    const { checkoutRequestId, merchantRequestId } = await mpesaService.initiateSTKPush({
      phone,
      amount,
      orderId,
      description,
    });

    // Store M-Pesa transaction record
    await prisma.mpesaTransaction.create({
      data: {
        paymentId: payment.id,
        phone: String(phone),
        checkoutRequestId,
        merchantRequestId,
        status: 'PENDING',
      },
    });

    res.status(202).json({
      paymentId: payment.id,
      checkoutRequestId,
      message: 'STK push sent. Await customer confirmation.',
    });
    broadcast('payment:initiated', {
      paymentId: payment.id,
      status: 'PENDING',
      checkoutRequestId,
      amount: payment.amount,
      externalOrderId: payment.externalOrderId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/mpesa/callback
 * Called by Safaricom after customer action (confirm / cancel / timeout).
 * Always respond 200 immediately — Safaricom may retry if we take too long.
 */
async function mpesaCallback(req, res, _next) {
  // Acknowledge receipt immediately
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    // Body was buffered as raw; parse it
    const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const parsed = mpesaService.parseCallback(body);

    const tx = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId: parsed.checkoutRequestId },
    });

    if (!tx) {
      console.error('[M-Pesa Callback] Unknown CheckoutRequestID:', parsed.checkoutRequestId);
      return;
    }

    if (tx.status !== 'PENDING') {
      // Already processed (duplicate callback)
      return;
    }

    const newTxStatus = parsed.success ? 'SUCCESS' : 'FAILED';
    const newPaymentStatus = parsed.success ? 'SUCCESS' : 'FAILED';

    await prisma.$transaction([
      prisma.mpesaTransaction.update({
        where: { id: tx.id },
        data: {
          status: newTxStatus,
          resultCode: parsed.resultCode,
          resultDesc: parsed.resultDesc,
          mpesaReceiptNumber: parsed.receiptNumber,
          amount: parsed.amount,
        },
      }),
      prisma.payment.update({
        where: { id: tx.paymentId },
        data: { status: newPaymentStatus },
      }),
    ]);

    console.log(`[M-Pesa] Payment ${tx.paymentId} → ${newPaymentStatus} (receipt: ${parsed.receiptNumber || 'N/A'})`);
    broadcast('payment:updated', {
      paymentId: tx.paymentId,
      status: newPaymentStatus,
      receiptNumber: parsed.receiptNumber || null,
      checkoutRequestId: parsed.checkoutRequestId,
    });
  } catch (err) {
    console.error('[M-Pesa Callback] Processing error:', err.message);
  }
}

/**
 * GET /api/payments
 * Payments monitor list:
 * - stk status
 * - failed/pending filter
 */
async function listPayments(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const where = status ? { status } : {};

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          mpesaTransaction: true,
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ data: payments, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/:id
 */
async function getPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { mpesaTransaction: true },
    });

    if (!payment) return next(createError(404, 'Payment not found'));
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/:id/retry
 */
async function retryPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { mpesaTransaction: true },
    });

    if (!payment) return next(createError(404, 'Payment not found'));
    if (payment.status === 'SUCCESS') {
      return next(createError(409, 'Payment is already successful'));
    }

    const retries = Number(req.body?.attempt || 0);
    if (retries >= MAX_RETRY_ATTEMPTS) {
      return next(createError(400, `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached`));
    }

    await addPaymentRetryJob(payment.id, retries);

    res.status(202).json({ message: 'Retry queued', paymentId: payment.id, attempt: retries + 1 });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiatePayment, mpesaCallback, listPayments, getPayment, retryPayment, MAX_RETRY_ATTEMPTS };
