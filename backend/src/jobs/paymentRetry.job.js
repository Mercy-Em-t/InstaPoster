'use strict';

/**
 * Payment Retry Job
 *
 * Retries a failed or timed-out M-Pesa STK push up to MAX_RETRY_ATTEMPTS times.
 */

const prisma = require('../db/prisma');
const mpesaService = require('../services/mpesa.service');

const MAX_RETRY_ATTEMPTS = 3;

/**
 * @param {import('bullmq').Job} job
 */
async function processPaymentRetry(job) {
  const { paymentId, attempt } = job.data;

  if (attempt >= MAX_RETRY_ATTEMPTS) {
    console.log(`[PaymentRetry] Payment ${paymentId} exceeded max retries — giving up`);
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { mpesaTransaction: true },
  });

  if (!payment) {
    console.warn(`[PaymentRetry] Payment ${paymentId} not found`);
    return;
  }

  if (payment.status === 'SUCCESS') {
    console.log(`[PaymentRetry] Payment ${paymentId} already succeeded — skipping retry`);
    return;
  }

  console.log(`[PaymentRetry] Retrying payment ${paymentId} (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);

  try {
    const { checkoutRequestId, merchantRequestId } = await mpesaService.initiateSTKPush({
      phone: payment.phone,
      amount: payment.amount,
      orderId: payment.externalOrderId || paymentId,
    });

    // Reset payment and update existing transaction record
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'PENDING' },
      }),
      prisma.mpesaTransaction.upsert({
        where: { paymentId },
        update: {
          phone: payment.phone,
          checkoutRequestId,
          merchantRequestId,
          status: 'PENDING',
          resultCode: null,
          resultDesc: null,
          mpesaReceiptNumber: null,
          amount: null,
        },
        create: {
          paymentId,
          phone: payment.phone,
          checkoutRequestId,
          merchantRequestId,
          status: 'PENDING',
        },
      }),
    ]);

    console.log(`[PaymentRetry] Retry STK push sent for payment ${paymentId}`);
  } catch (err) {
    console.error(`[PaymentRetry] Retry failed for payment ${paymentId}:`, err.message);
    throw err; // let BullMQ handle as job failure
  }
}

module.exports = { processPaymentRetry, MAX_RETRY_ATTEMPTS };
