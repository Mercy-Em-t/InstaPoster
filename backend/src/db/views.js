'use strict';

/**
 * Unified Product Views
 *
 * These SQL statements create views that UNION data from the existing shop
 * database schemas so that InstaPoster never duplicates product/inventory data.
 *
 * Run these once in your shared PostgreSQL instance (or via a DB migration tool).
 *
 * NOTE: Adjust schema names (main_store / secondary_store) and column names
 *       to match your actual existing database schemas.
 */

const UNIFIED_PRODUCTS_VIEW = `
CREATE OR REPLACE VIEW unified_products AS
  SELECT
      p.id::TEXT          AS product_id,
      p.name              AS name,
      p.price             AS price,
      p.stock_quantity    AS stock_quantity,
      p.image_url         AS image_url,
      p.description       AS description,
      p.is_active         AS is_active,
      'main_store'        AS source
  FROM main_store.products p

  UNION ALL

  SELECT
      s.id::TEXT          AS product_id,
      s.title             AS name,
      s.unit_price        AS price,
      s.qty               AS stock_quantity,
      s.image             AS image_url,
      s.details           AS description,
      TRUE                AS is_active,
      'secondary_store'   AS source
  FROM secondary_store.items s
  WHERE s.is_archived = FALSE;
`;

const UNIFIED_INVENTORY_VIEW = `
CREATE OR REPLACE VIEW unified_inventory AS
  SELECT
      i.product_id::TEXT  AS product_id,
      i.stock_quantity    AS stock_quantity,
      i.reorder_level     AS reorder_level,
      i.last_updated      AS last_updated,
      'main_store'        AS source
  FROM main_store.inventory i

  UNION ALL

  SELECT
      st.item_id::TEXT    AS product_id,
      st.qty              AS stock_quantity,
      st.min_qty          AS reorder_level,
      st.updated_at       AS last_updated,
      'secondary_store'   AS source
  FROM secondary_store.stock st;
`;

module.exports = { UNIFIED_PRODUCTS_VIEW, UNIFIED_INVENTORY_VIEW };
