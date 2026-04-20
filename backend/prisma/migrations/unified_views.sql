-- ─────────────────────────────────────────────────────────────────────────────
-- InstaPoster: Unified Product & Inventory Views
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this script ONCE in your shared PostgreSQL database.
-- These views allow InstaPoster to READ from existing shop schemas without
-- duplicating any data. They use UNION ALL so that each source is clearly
-- labelled and product_id collisions across stores are disambiguated by
-- the `source` column.
--
-- IMPORTANT: Adjust column names to match your actual schemas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Unified Products View ────────────────────────────────────────────────────
-- Reads from:
--   main_store.products   — primary retail database
--   secondary_store.items — any additional store/catalog
CREATE OR REPLACE VIEW unified_products AS

  SELECT
      p.id::TEXT              AS product_id,
      p.name                  AS name,
      p.price                 AS price,
      p.stock_quantity        AS stock_quantity,
      p.image_url             AS image_url,
      p.description           AS description,
      p.is_active             AS is_active,
      'main_store'::TEXT      AS source
  FROM main_store.products p

  UNION ALL

  SELECT
      s.id::TEXT              AS product_id,
      s.title                 AS name,
      s.unit_price            AS price,
      s.qty                   AS stock_quantity,
      s.image                 AS image_url,
      s.details               AS description,
      (NOT s.is_archived)     AS is_active,
      'secondary_store'::TEXT AS source
  FROM secondary_store.items s;


-- ── Unified Inventory View ───────────────────────────────────────────────────
-- Optional: gives a single surface to check stock across all stores.
CREATE OR REPLACE VIEW unified_inventory AS

  SELECT
      i.product_id::TEXT      AS product_id,
      i.stock_quantity        AS stock_quantity,
      i.reorder_level         AS reorder_level,
      i.last_updated          AS last_updated,
      'main_store'::TEXT      AS source
  FROM main_store.inventory i

  UNION ALL

  SELECT
      st.item_id::TEXT        AS product_id,
      st.qty                  AS stock_quantity,
      st.min_qty              AS reorder_level,
      st.updated_at           AS last_updated,
      'secondary_store'::TEXT AS source
  FROM secondary_store.stock st;


-- ── Indexes on source views (if permissions allow) ───────────────────────────
-- NOTE: PostgreSQL does not support indexes directly on views.
-- Create indexes on the underlying tables instead:
--
-- CREATE INDEX IF NOT EXISTS idx_products_is_active ON main_store.products (is_active);
-- CREATE INDEX IF NOT EXISTS idx_products_name ON main_store.products (name);
-- CREATE INDEX IF NOT EXISTS idx_items_is_archived ON secondary_store.items (is_archived);


-- ── Grant read access to InstaPoster DB user ─────────────────────────────────
-- Replace 'instaposter_user' with your actual application DB user.
--
-- GRANT SELECT ON unified_products  TO instaposter_user;
-- GRANT SELECT ON unified_inventory TO instaposter_user;
