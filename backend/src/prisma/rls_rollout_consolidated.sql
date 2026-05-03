BEGIN;

-- ============================================================================
-- Ubhona consolidated PostgreSQL RLS rollout
-- ============================================================================
-- Goal:
--   Enforce multi-tenant isolation using app.restaurant_id as the tenant seam.
--
-- Included:
--   1. app schema helper functions
--   2. structural hardening for tenant-scoped tables
--   3. enable + force RLS
--   4. CRUD policies for tenant-scoped tables
--   5. trigger-based restaurant_id stamping
--   6. admin-only policies for system tables, when present
--   7. mixed-scope users table policies, when present
--
-- Assumptions:
--   - PostgreSQL
--   - public.restaurants(id) exists and is UUID-compatible
--   - tenant tables should fail closed if tenant/user session context is absent
--   - public.payments may not yet have restaurant_id; this migration backfills it
--     from public.orders before enabling tenant-native RLS policies
--   - public.platform_tracker_documents.restaurant_id may exist as nullable text
--     or UUID-compatible content; invalid values should stop the migration
--
-- Notes:
--   - FORCE ROW LEVEL SECURITY is used intentionally so even table owners do not
--     silently bypass policy behavior during normal app execution
--   - Dynamic blocks are used where tables are optional so deployment does not
--     fail on environments that do not yet contain those surfaces
-- ============================================================================

-- ============================================================================
-- 1) App schema and helper functions
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

COMMENT ON SCHEMA app IS
  'Application-owned SQL helpers for tenant/session context and PostgreSQL RLS evaluation.';

CREATE OR REPLACE FUNCTION app.require_uuid_setting(setting_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_value text;
BEGIN
  raw_value := nullif(btrim(current_setting(setting_name, true)), '');

  -- Fail closed: missing tenant or user context must never be interpreted as
  -- broad access.
  IF raw_value IS NULL THEN
    RAISE EXCEPTION 'Missing required session setting: %', setting_name
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    RETURN raw_value::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID in session setting %: %', setting_name, raw_value
        USING ERRCODE = '22023';
  END;
END;
$$;

COMMENT ON FUNCTION app.require_uuid_setting(text)
IS 'Returns a required UUID session setting. Fails closed if missing, blank, or malformed.';

CREATE OR REPLACE FUNCTION app.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT app.require_uuid_setting('app.restaurant_id');
$$;

COMMENT ON FUNCTION app.current_restaurant_id()
IS 'Returns the current tenant restaurant UUID from app.restaurant_id. Fails closed if unset.';

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT app.require_uuid_setting('app.user_id');
$$;

COMMENT ON FUNCTION app.current_user_id()
IS 'Returns the current authenticated user UUID from app.user_id. Fails closed if unset.';

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(coalesce(nullif(btrim(current_setting('app.is_admin', true)), ''), 'false'))
    WHEN 'true' THEN true
    WHEN 't' THEN true
    WHEN '1' THEN true
    WHEN 'yes' THEN true
    WHEN 'y' THEN true
    WHEN 'on' THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION app.is_admin()
IS 'Returns true only for explicit truthy app.is_admin values. Missing or malformed values fail closed to false.';

-- ============================================================================
-- 2) Structural hardening for tenant-scoped tables
-- ============================================================================

DO $$
BEGIN
  -- -------------------------------------------------------------------------
  -- payments.restaurant_id
  -- Backfill from orders before RLS policies assume tenant-native ownership.
  -- -------------------------------------------------------------------------
  IF to_regclass('public.payments') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payments'
        AND column_name = 'restaurant_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.payments ADD COLUMN restaurant_id uuid';
    END IF;

    IF to_regclass('public.orders') IS NOT NULL THEN
      EXECUTE '
        UPDATE public.payments p
        SET restaurant_id = o.restaurant_id
        FROM public.orders o
        WHERE p.order_id = o.id
          AND p.restaurant_id IS NULL
      ';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- platform_tracker_documents.restaurant_id
  -- Normalize to UUID-compatible content and fail if existing values are bad.
  -- -------------------------------------------------------------------------
  IF to_regclass('public.platform_tracker_documents') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'platform_tracker_documents'
        AND column_name = 'restaurant_id'
        AND data_type <> 'uuid'
    ) THEN
      EXECUTE '
        ALTER TABLE public.platform_tracker_documents
        ALTER COLUMN restaurant_id
        TYPE uuid
        USING nullif(btrim(restaurant_id::text), '''')::uuid
      ';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- NOT NULL tenant seam
  -- -------------------------------------------------------------------------
  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.categories ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;

  IF to_regclass('public.dishes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.dishes ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.payments ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;

  IF to_regclass('public.upload_assets') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.upload_assets ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.analytics_events ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;

  IF to_regclass('public.platform_tracker_documents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.platform_tracker_documents ALTER COLUMN restaurant_id SET NOT NULL';
  END IF;
END;
$$;

-- Foreign keys and baseline tenant indexes.
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'categories_restaurant_id_fkey'
        AND conrelid = 'public.categories'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.categories
        ADD CONSTRAINT categories_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort_created ON public.categories(restaurant_id, sort_order, created_at DESC)';
  END IF;

  IF to_regclass('public.dishes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'dishes_restaurant_id_fkey'
        AND conrelid = 'public.dishes'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.dishes
        ADD CONSTRAINT dishes_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON public.dishes(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_created ON public.dishes(restaurant_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_available_created ON public.dishes(restaurant_id, is_available, created_at DESC)';
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orders_restaurant_id_fkey'
        AND conrelid = 'public.orders'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON public.orders(restaurant_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created ON public.orders(restaurant_id, status, created_at DESC)';
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'payments_restaurant_id_fkey'
        AND conrelid = 'public.payments'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.payments
        ADD CONSTRAINT payments_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON public.payments(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_restaurant_created ON public.payments(restaurant_id, created_at DESC)';
  END IF;

  IF to_regclass('public.upload_assets') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'upload_assets_restaurant_id_fkey'
        AND conrelid = 'public.upload_assets'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.upload_assets
        ADD CONSTRAINT upload_assets_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_upload_assets_restaurant_id ON public.upload_assets(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_upload_assets_restaurant_created ON public.upload_assets(restaurant_id, created_at DESC)';
  END IF;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'analytics_events_restaurant_id_fkey'
        AND conrelid = 'public.analytics_events'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.analytics_events
        ADD CONSTRAINT analytics_events_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_id ON public.analytics_events(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_created ON public.analytics_events(restaurant_id, created_at DESC)';
  END IF;

  IF to_regclass('public.platform_tracker_documents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'platform_tracker_documents_restaurant_id_fkey'
        AND conrelid = 'public.platform_tracker_documents'::regclass
    ) THEN
      EXECUTE '
        ALTER TABLE public.platform_tracker_documents
        ADD CONSTRAINT platform_tracker_documents_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
      ';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_platform_tracker_documents_restaurant_id ON public.platform_tracker_documents(restaurant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_platform_tracker_documents_restaurant_updated ON public.platform_tracker_documents(restaurant_id, updated_at DESC)';
  END IF;
END;
$$;

-- ============================================================================
-- 3) Enable and force RLS
-- ============================================================================

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      -- FORCE RLS is intentional: do not allow implicit owner bypass in normal app use.
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4) Canonical tenant CRUD policies
-- ============================================================================

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', table_name, table_name);

    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT USING (app.is_admin() OR restaurant_id = app.current_restaurant_id())',
      table_name,
      table_name
    );

    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (app.is_admin() OR restaurant_id = app.current_restaurant_id())',
      table_name,
      table_name
    );

    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE USING (app.is_admin() OR restaurant_id = app.current_restaurant_id()) WITH CHECK (app.is_admin() OR restaurant_id = app.current_restaurant_id())',
      table_name,
      table_name
    );

    EXECUTE format(
      'CREATE POLICY %I_delete ON public.%I FOR DELETE USING (app.is_admin() OR restaurant_id = app.current_restaurant_id())',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 5) Trigger-based restaurant_id stamping
-- Second line of defense beyond RLS:
-- - stamps tenant ownership when a row is created without restaurant_id
-- - blocks non-admin cross-tenant writes before they reach storage
-- ============================================================================

CREATE OR REPLACE FUNCTION app.set_restaurant_id_from_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    NEW.restaurant_id := app.current_restaurant_id();
  END IF;

  IF NOT app.is_admin() AND NEW.restaurant_id <> app.current_restaurant_id() THEN
    RAISE EXCEPTION 'cross-tenant write denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.set_restaurant_id_from_session()
IS 'Stamps NEW.restaurant_id from tenant session context when null and blocks cross-tenant writes for non-admins.';

DO $$
DECLARE
  table_name text;
  trigger_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    trigger_name := format('%s_set_restaurant_id_from_session', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.set_restaurant_id_from_session()',
      trigger_name,
      table_name
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 6) Admin-only tables
-- These differ from tenant tables because they are platform-administration
-- surfaces, not restaurant-owned data.
-- ============================================================================

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'audit_logs',
    'admin_users',
    'platform_configs'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);

    policy_name := format('%s_admin_only', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (app.is_admin()) WITH CHECK (app.is_admin())',
      policy_name,
      table_name
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 7) Mixed-scope users table
-- Security intent:
-- - platform admins may manage all users
-- - non-admin sessions may only read/update their own row
-- - inserts and deletes remain admin-only
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS users_select_self_or_admin ON public.users;
    DROP POLICY IF EXISTS users_insert_admin_only ON public.users;
    DROP POLICY IF EXISTS users_update_self_or_admin ON public.users;
    DROP POLICY IF EXISTS users_delete_admin_only ON public.users;

    CREATE POLICY users_select_self_or_admin
    ON public.users
    FOR SELECT
    USING (
      app.is_admin()
      OR id = app.current_user_id()
    );

    CREATE POLICY users_insert_admin_only
    ON public.users
    FOR INSERT
    WITH CHECK (
      app.is_admin()
    );

    CREATE POLICY users_update_self_or_admin
    ON public.users
    FOR UPDATE
    USING (
      app.is_admin()
      OR id = app.current_user_id()
    )
    WITH CHECK (
      app.is_admin()
      OR id = app.current_user_id()
    );

    CREATE POLICY users_delete_admin_only
    ON public.users
    FOR DELETE
    USING (
      app.is_admin()
    );
  END IF;
END;
$$;

COMMIT;
