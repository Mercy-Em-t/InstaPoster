'use strict';

const prisma = require('../../db/prisma');

/**
 * GET /api/orders
 * Orders dashboard data (from bridge):
 * - external order id
 * - payment status
 * - tracking source (which post)
 */
async function listOrders(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [bridges, total] = await Promise.all([
      prisma.orderBridge.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          trackingLink: {
            include: {
              post: {
                select: { id: true, title: true, instagramPostId: true },
              },
            },
          },
        },
      }),
      prisma.orderBridge.count(),
    ]);

    const externalOrderIds = [...new Set(bridges.map((b) => b.externalOrderId).filter(Boolean))];
    const payments = externalOrderIds.length
      ? await prisma.payment.findMany({
          where: { externalOrderId: { in: externalOrderIds } },
          include: { mpesaTransaction: true },
        })
      : [];

    const paymentsByOrder = new Map(payments.map((p) => [p.externalOrderId, p]));

    const data = bridges.map((bridge) => {
      const payment = paymentsByOrder.get(bridge.externalOrderId);
      return {
        id: bridge.id,
        externalOrderId: bridge.externalOrderId,
        sourceSystem: bridge.sourceSystem,
        createdAt: bridge.createdAt,
        paymentStatus: payment?.status || 'NOT_STARTED',
        paymentAmount: payment?.amount || null,
        paymentId: payment?.id || null,
        stkStatus: payment?.mpesaTransaction?.status || null,
        receiptNumber: payment?.mpesaTransaction?.mpesaReceiptNumber || null,
        trackingCode: bridge.trackingLink?.code || null,
        post: bridge.trackingLink?.post || null,
      };
    });

    res.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listOrders };
