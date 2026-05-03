-- Ubhona RLS structural prerequisites for tenant-scoped tables
--
-- Goal:
-- - ensure every tenant-scoped table has a native restaurant_id column suitable
--   for fail-closed RLS policies
-- - tighten nullability and foreign keys before policy rollout
-- - add restaurant_id indexes for tenant-filtered access paths
--
-- Assumptions:
-- 1. restaurants.id is the canonical tenant key and is a UUID-compatible column.
-- 2. categories, dishes, orders, upload_assets, and analytics_events already
--    use restaurant_id as their tenant key.
-- 3. payments is tenant-scoped through orders today; this migration adds a
--    native restaurant_id and backfills it from orders.
-- 4. platform_tracker_documents.restaurant_id may exist as nullable text from a
--    prior app-layer hardening step. This migration upgrades it to UUID if
--    needed and fails closed if invalid values remain.
-- 5. If orphaned or missing tenant mappings exist, the migration raises instead
--    of silently widening access. That is intentional for production safety.

BEGIN;

-- ---------------------------------------------------------------------------
-- payments: add a native tenant key, backfill from orders, then tighten.
-- ---------------------------------------------------------------------------

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS restaurant_id uuid;

COMMENT ON COLUMN payments.restaurant_id IS
  'Canonical tenant key for RLS. Backfilled from orders.restaurant_id.';

UPDATE payments p
SET restaurant_id = o.restaurant_id
FROM orders o
WHERE p.order_id = o.id
  AND p.restaurant_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payments
    WHERE restaurant_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'payments.restaurant_id backfill incomplete; refusing to enable NOT NULL prerequisite for RLS';
  END IF;
END;
$$;

ALTER TABLE payments
ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_restaurant_id_fkey'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS payments_restaurant_id_idx
  ON payments (restaurant_id);

-- ---------------------------------------------------------------------------
-- platform_tracker_documents: normalize tenant key to UUID and tighten.
-- ---------------------------------------------------------------------------

-- If restaurant_id was previously added as text, backfill NULLs conservatively
-- from the document key shape "...:<restaurant-id>:...". Only UUID-like values
-- are accepted; anything else causes the migration to fail closed below.
UPDATE platform_tracker_documents
SET restaurant_id = split_part(key, ':', 2)
WHERE restaurant_id IS NULL
  AND split_part(key, ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

DO $$
DECLARE
  restaurant_id_type text;
BEGIN
  SELECT a.atttypid::regtype::text
  INTO restaurant_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'platform_tracker_documents'::regclass
    AND a.attname = 'restaurant_id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF restaurant_id_type IS NULL THEN
    RAISE EXCEPTION
      'platform_tracker_documents.restaurant_id is missing; refusing to continue';
  END IF;

  IF restaurant_id_type <> 'uuid' THEN
    IF EXISTS (
      SELECT 1
      FROM platform_tracker_documents
      WHERE restaurant_id IS NOT NULL
        AND btrim(restaurant_id::text) <> ''
        AND restaurant_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) THEN
      RAISE EXCEPTION
        'platform_tracker_documents.restaurant_id contains non-UUID values; clean them before enabling RLS prerequisites';
    END IF;

    EXECUTE $sql$
      ALTER TABLE platform_tracker_documents
      ALTER COLUMN restaurant_id
      TYPE uuid
      USING nullif(btrim(restaurant_id::text), '')::uuid
    $sql$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM platform_tracker_documents
    WHERE restaurant_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'platform_tracker_documents.restaurant_id contains NULLs after conservative backfill; refusing NOT NULL prerequisite for RLS';
  END IF;
END;
$$;

ALTER TABLE platform_tracker_documents
ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_tracker_documents_restaurant_id_fkey'
      AND conrelid = 'platform_tracker_documents'::regclass
  ) THEN
    ALTER TABLE platform_tracker_documents
      ADD CONSTRAINT platform_tracker_documents_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS platform_tracker_documents_restaurant_id_idx
  ON platform_tracker_documents (restaurant_id);

-- ---------------------------------------------------------------------------
-- Existing tenant-key tables: make nullability, FK coverage, and indexes explicit.
-- ---------------------------------------------------------------------------

ALTER TABLE categories
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE dishes
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE orders
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE upload_assets
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE analytics_events
ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_restaurant_id_fkey'
      AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dishes_restaurant_id_fkey'
      AND conrelid = 'dishes'::regclass
  ) THEN
    ALTER TABLE dishes
      ADD CONSTRAINT dishes_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_restaurant_id_fkey'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'upload_assets_restaurant_id_fkey'
      AND conrelid = 'upload_assets'::regclass
  ) THEN
    ALTER TABLE upload_assets
      ADD CONSTRAINT upload_assets_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analytics_events_restaurant_id_fkey'
      AND conrelid = 'analytics_events'::regclass
  ) THEN
    ALTER TABLE analytics_events
      ADD CONSTRAINT analytics_events_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES restaurants(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS categories_restaurant_id_idx
  ON categories (restaurant_id);

CREATE INDEX IF NOT EXISTS dishes_restaurant_id_idx
  ON dishes (restaurant_id);

CREATE INDEX IF NOT EXISTS orders_restaurant_id_idx
  ON orders (restaurant_id);

CREATE INDEX IF NOT EXISTS upload_assets_restaurant_id_idx
  ON upload_assets (restaurant_id);

CREATE INDEX IF NOT EXISTS analytics_events_restaurant_id_idx
  ON analytics_events (restaurant_id);

COMMIT;

-- ---------------------------------------------------------------------------
-- Validation query
--
-- Reports, for each tenant-scoped table:
-- - whether restaurant_id is present and NOT NULL
-- - whether a restaurant_id index exists
-- - whether an FK to restaurants(id) exists
-- ---------------------------------------------------------------------------
WITH target_tables AS (
  SELECT unnest(ARRAY[
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  ]) AS table_name
),
column_state AS (
  SELECT
    c.table_name,
    c.column_name,
    c.is_nullable,
    c.data_type,
    c.udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = 'restaurant_id'
),
index_state AS (
  SELECT
    t.relname AS table_name,
    bool_or(i.indexdef ILIKE '%(restaurant_id%') AS has_restaurant_id_index
  FROM pg_indexes i
  JOIN pg_class t
    ON t.relname = i.tablename
  WHERE i.schemaname = 'public'
  GROUP BY t.relname
),
fk_state AS (
  SELECT
    rel.relname AS table_name,
    bool_or(
      confrel.relname = 'restaurants'
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS conattnum(attnum)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = conattnum.attnum
        WHERE att.attname = 'restaurant_id'
      )
    ) AS has_restaurant_fk
  FROM pg_constraint con
  JOIN pg_class rel
    ON rel.oid = con.conrelid
  JOIN pg_class confrel
    ON confrel.oid = con.confrelid
  WHERE con.contype = 'f'
  GROUP BY rel.relname
)
SELECT
  tt.table_name,
  cs.data_type,
  cs.udt_name,
  (cs.column_name IS NOT NULL) AS has_restaurant_id,
  (cs.is_nullable = 'NO') AS restaurant_id_not_null,
  COALESCE(ix.has_restaurant_id_index, false) AS has_restaurant_id_index,
  COALESCE(fk.has_restaurant_fk, false) AS has_restaurant_fk
FROM target_tables tt
LEFT JOIN column_state cs
  ON cs.table_name = tt.table_name
LEFT JOIN index_state ix
  ON ix.table_name = tt.table_name
LEFT JOIN fk_state fk
  ON fk.table_name = tt.table_name
ORDER BY tt.table_name;
