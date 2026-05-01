-- Ubhona RLS performance hardening for tenant-scoped tables
--
-- Purpose:
-- - keep tenant-isolated access paths index-supported once RLS injects
--   restaurant_id filters into protected queries
-- - prioritize correctness and obvious hot paths before adding narrower
--   specialist indexes
--
-- Why tenant-key indexing matters under RLS:
-- - RLS policies add tenant predicates to normal queries
-- - if restaurant_id is not part of a useful index, the planner is pushed
--   toward broader scans before it can discard other tenants' rows
-- - tenant-first indexes reduce both latency and cross-tenant heap churn
--   without changing security semantics

BEGIN;

-- ---------------------------------------------------------------------------
-- categories
-- Common path:
-- - manager and storefront category lists filter by restaurant_id and order by
--   sort_order, created_at
-- Must-have:
-- - support tenant filter + category sort in one index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort_created
  ON public.categories (restaurant_id, sort_order, created_at DESC);

-- ---------------------------------------------------------------------------
-- dishes
-- Common paths:
-- - manager list: WHERE restaurant_id ORDER BY created_at DESC
-- - storefront list: WHERE restaurant_id AND is_available = true
--   ORDER BY created_at DESC
-- Must-have:
-- - one tenant timeline index for all dish lists
-- - one tenant + availability index for public menu reads
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_created
  ON public.dishes (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_available_created
  ON public.dishes (restaurant_id, is_available, created_at DESC);

-- ---------------------------------------------------------------------------
-- orders
-- Common paths:
-- - tenant order feed: WHERE restaurant_id ORDER BY created_at DESC
-- - filtered tenant order feed: WHERE restaurant_id AND status = ?
--   ORDER BY created_at DESC
-- Must-have:
-- - baseline tenant timeline index
-- - tenant + status timeline index for kitchen/dashboard filtering
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON public.orders (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON public.orders (restaurant_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- payments
-- Assumption:
-- - structural RLS hardening has added public.payments.restaurant_id
--   before this migration is applied
--
-- Common path after native tenant scoping:
-- - tenant payment inspection and reconciliation should not require scanning
--   across all restaurants
-- Must-have:
-- - tenant timeline index if restaurant_id exists
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'restaurant_id'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_payments_restaurant_created
      ON public.payments (restaurant_id, created_at DESC)
    ';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- upload_assets
-- Existing schema already has (restaurant_id, asset_type).
-- Common path still needs efficient tenant timeline scans for uploads/history.
-- Must-have:
-- - tenant + created_at index for recent asset lists and RLS pruning
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_upload_assets_restaurant_created
  ON public.upload_assets (restaurant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- analytics_events
-- Existing indexes are strong for event_type and dish-specific breakdowns, but
-- summary queries also scan by restaurant_id + created_at range alone.
-- Must-have:
-- - tenant + time index for broad analytics windows under RLS
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_created
  ON public.analytics_events (restaurant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- platform_tracker_documents
-- Existing schema already has a simple restaurant_id index.
-- Common path:
-- - tenant document feeds and recency-ordered operational lists use
--   restaurant_id plus updated_at DESC
-- Must-have:
-- - tenant recency index for operational document lookups under RLS
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_platform_tracker_documents_restaurant_updated
  ON public.platform_tracker_documents (restaurant_id, updated_at DESC);

COMMIT;

-- ---------------------------------------------------------------------------
-- Validation query
-- Shows tenant-focused indexes on the target tables after the migration.
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  )
  AND (
    indexdef ILIKE '%restaurant_id%'
    OR indexname ILIKE '%restaurant%'
  )
ORDER BY tablename, indexname;
