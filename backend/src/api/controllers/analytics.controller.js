'use strict';

const prisma = require('../../db/prisma');

/**
 * GET /api/analytics/posts
 * Returns per-post metrics:
 * - clicks per post
 * - sales per post
 * - conversion rate
 */
async function getPostAnalytics(req, res, next) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        cp.id AS "postId",
        cp.title,
        cp.status,
        cp."postedAt",
        COALESCE(COUNT(DISTINCT lc.id), 0)::int AS clicks,
        COALESCE(COUNT(DISTINCT ob.id), 0)::int AS sales,
        CASE
          WHEN COALESCE(COUNT(DISTINCT lc.id), 0) = 0 THEN 0
          ELSE ROUND((COUNT(DISTINCT ob.id)::decimal / COUNT(DISTINCT lc.id)::decimal) * 100, 2)
        END AS "conversionRate"
      FROM content_posts cp
      LEFT JOIN tracking_links tl ON tl."postId" = cp.id
      LEFT JOIN link_clicks lc ON lc."trackingLinkId" = tl.id
      LEFT JOIN orders_bridge ob ON ob."trackingLinkId" = tl.id
      GROUP BY cp.id, cp.title, cp.status, cp."postedAt"
      ORDER BY cp."createdAt" DESC;
    `;

    const totals = rows.reduce(
      (acc, row) => {
        acc.clicks += Number(row.clicks || 0);
        acc.sales += Number(row.sales || 0);
        return acc;
      },
      { clicks: 0, sales: 0 }
    );

    const overallConversionRate = totals.clicks > 0
      ? Number(((totals.sales / totals.clicks) * 100).toFixed(2))
      : 0;

    res.json({
      data: rows,
      summary: {
        totalPosts: rows.length,
        totalClicks: totals.clicks,
        totalSales: totals.sales,
        overallConversionRate,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPostAnalytics };
