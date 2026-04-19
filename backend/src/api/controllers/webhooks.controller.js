'use strict';

/**
 * Webhooks Controller
 *
 * Receives events from existing shop systems so InstaPoster can:
 *   - Link orders back to the Instagram tracking link that referred them
 *   - Record attribution data without duplicating the order
 */

const prisma = require('../../db/prisma');
const { createError } = require('../../middleware/errorHandler');

/**
 * POST /api/webhooks/order-created
 *
 * Expected payload:
 * {
 *   "order_id": "12345",
 *   "source": "main_store",
 *   "tracking_code": "abc123"   // optional — the ref code from the tracking link
 * }
 */
async function orderCreated(req, res, next) {
  try {
    const { order_id, source, tracking_code } = req.body;

    if (!order_id || !source) {
      return next(createError(400, 'order_id and source are required'));
    }

    let trackingLinkId = null;

    if (tracking_code) {
      const link = await prisma.trackingLink.findUnique({
        where: { code: tracking_code },
      });
      if (link) trackingLinkId = link.id;
    }

    const bridge = await prisma.orderBridge.create({
      data: {
        externalOrderId: String(order_id),
        sourceSystem: source,
        trackingLinkId,
      },
    });

    console.log(`[Webhook] Order ${order_id} from ${source} bridged (link: ${tracking_code || 'none'})`);
    res.status(201).json(bridge);
  } catch (err) {
    next(err);
  }
}

module.exports = { orderCreated };
