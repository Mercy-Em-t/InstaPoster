'use strict';

/**
 * Payment Monitor Job (runs every 2 minutes)
 *
 * Scans for M-Pesa transactions stuck in PENDING beyond the timeout window.
 * Marks timed-out transactions and their parent payments as TIMEOUT.
 */

const prisma = require('../db/prisma');

const TIMEOUT_MINUTES = 5;

/**
 * @param {import('bullmq').Job} _job
 */
async function processPaymentMonitor(_job) {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  const stale = await prisma.mpesaTransaction.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, paymentId: true },
  });

  if (!stale.length) return;

  console.log(`[PaymentMonitor] Timing out ${stale.length} stale M-Pesa transaction(s)`);

  await prisma.$transaction(
    stale.flatMap(({ id, paymentId }) => [
      prisma.mpesaTransaction.update({
        where: { id },
        data: { status: 'TIMEOUT', resultDesc: 'Timed out — no callback received' },
      }),
      prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'TIMEOUT' },
      }),
    ])
  );
}

module.exports = { processPaymentMonitor };
