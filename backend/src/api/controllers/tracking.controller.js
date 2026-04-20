'use strict';

/**
 * Tracking Controller
 *
 * Handles short-link clicks:
 *   1. Find the tracking link by code
 *   2. Log the click (IP, UA, device type)
 *   3. Redirect to the associated product/shop page
 */

const prisma = require('../../db/prisma');
const { createError } = require('../../middleware/errorHandler');

/**
 * GET /api/t/:code
 * Log click and redirect to product page.
 */
async function handleClick(req, res, next) {
  try {
    const { code } = req.params;

    const link = await prisma.trackingLink.findUnique({
      where: { code },
      include: { post: true },
    });

    if (!link) return next(createError(404, 'Link not found'));

    // Log the click (fire-and-forget)
    const userAgent = req.get('user-agent') || '';
    const deviceType = detectDeviceType(userAgent);

    prisma.linkClick
      .create({
        data: {
          trackingLinkId: link.id,
          ipAddress: req.ip,
          userAgent,
          deviceType,
        },
      })
      .catch((err) => console.error('[Tracking] Failed to log click:', err.message));

    // Build redirect URL — configurable via FRONTEND_URL or query param
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${baseUrl}/shop?ref=${code}`;

    res.redirect(302, redirectUrl);
  } catch (err) {
    next(err);
  }
}

function detectDeviceType(userAgent) {
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

module.exports = { handleClick };
