'use strict';

/**
 * Analytics Aggregation Job (runs every hour)
 *
 * Aggregates:
 *   - Total clicks per tracking link per day
 *   - Conversion rate (clicks → orders)
 *
 * Results are logged; in production, store them in a dedicated
 * analytics table or push to a monitoring service (e.g. Grafana, Mixpanel).
 */

const prisma = require('../db/prisma');

/**
 * @param {import('bullmq').Job} _job
 */
async function processAnalytics(_job) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    // Clicks per tracking link
    const clickGroups = await prisma.linkClick.groupBy({
      by: ['trackingLinkId'],
      _count: { id: true },
      where: { clickedAt: { gte: since } },
    });

    // Orders attributed per tracking link
    const orderGroups = await prisma.orderBridge.groupBy({
      by: ['trackingLinkId'],
      _count: { id: true },
      where: {
        createdAt: { gte: since },
        trackingLinkId: { not: null },
      },
    });

    const orderMap = new Map(orderGroups.map((g) => [g.trackingLinkId, g._count.id]));

    const report = clickGroups.map((g) => {
      const clicks = g._count.id;
      const orders = orderMap.get(g.trackingLinkId) || 0;
      return {
        trackingLinkId: g.trackingLinkId,
        clicks,
        orders,
        conversionRate: clicks > 0 ? ((orders / clicks) * 100).toFixed(2) + '%' : '0%',
      };
    });

    if (report.length) {
      console.log('[Analytics] Last 24h report:', JSON.stringify(report, null, 2));
    } else {
      console.log('[Analytics] No click data in the last 24h');
    }
  } catch (err) {
    console.error('[Analytics] Aggregation failed:', err.message);
  }
}

module.exports = { processAnalytics };
