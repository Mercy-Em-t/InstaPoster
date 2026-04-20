'use strict';

/**
 * Products Controller
 *
 * Reads ONLY from unified_products and unified_inventory SQL views —
 * which are UNION queries over the existing shop database schemas.
 * This service never writes product data.
 */

const { Pool } = require('pg');
const { createError } = require('../../middleware/errorHandler');

// Shared pool for unified product views
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

/**
 * GET /api/products
 * List products from the unified view with optional search & pagination.
 */
async function listProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const source = req.query.source; // optional filter: "main_store" | "secondary_store"

    let query;
    let params;

    if (source) {
      query = `
        SELECT * FROM unified_products
        WHERE is_active = TRUE AND name ILIKE $1 AND source = $2
        ORDER BY name
        LIMIT $3 OFFSET $4
      `;
      params = [search, source, limit, offset];
    } else {
      query = `
        SELECT * FROM unified_products
        WHERE is_active = TRUE AND name ILIKE $1
        ORDER BY name
        LIMIT $2 OFFSET $3
      `;
      params = [search, limit, offset];
    }

    const countQuery = source
      ? `SELECT COUNT(*) FROM unified_products WHERE is_active = TRUE AND name ILIKE $1 AND source = $2`
      : `SELECT COUNT(*) FROM unified_products WHERE is_active = TRUE AND name ILIKE $1`;
    const countParams = source ? [search, source] : [search];

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      data: result.rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:id
 * Get a specific product by id + source from the unified view.
 * Query param: source (required to disambiguate across stores)
 */
async function getProduct(req, res, next) {
  try {
    const { id } = req.params;
    const source = req.query.source || 'main_store';

    const { rows } = await pool.query(
      `SELECT * FROM unified_products WHERE product_id = $1 AND source = $2 LIMIT 1`,
      [id, source]
    );

    if (!rows.length) return next(createError(404, 'Product not found'));
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct };
