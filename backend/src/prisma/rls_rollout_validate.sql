-- Ubhona operational RLS validation
--
-- How to use:
-- - Run this only after applying rls_rollout_consolidated.sql or the minimal
--   callback-environment alignment files.
-- - Use the same database role as the application, not a superuser.
-- - Run it against local/dev first, then staging, then production.
-- - The script raises exceptions on failed security checks and rolls back all
--   probe writes so it is safe to re-run.

-- ============================================================================
-- 1) Structural + policy inventory
-- ============================================================================
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents',
    'audit_logs',
    'admin_users',
    'platform_configs',
    'users'
  )
ORDER BY c.relname;

DO $$
DECLARE
  missing_rls_tables text[];
BEGIN
  SELECT array_agg(t.table_name ORDER BY t.table_name)
  INTO missing_rls_tables
  FROM (
    SELECT unnest(ARRAY[
      'categories',
      'dishes',
      'orders',
      'payments',
      'upload_assets',
      'analytics_events',
      'platform_tracker_documents'
    ]) AS table_name
  ) AS t
  LEFT JOIN pg_class c
    ON c.relnamespace = 'public'::regnamespace
   AND c.relname = t.table_name
  WHERE c.oid IS NULL
     OR NOT c.relrowsecurity
     OR NOT c.relforcerowsecurity;

  IF missing_rls_tables IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled+forced on: %', array_to_string(missing_rls_tables, ', ');
  END IF;
END;
$$;

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents',
    'audit_logs',
    'admin_users',
    'platform_configs',
    'users'
  )
ORDER BY tablename, cmd, policyname;

DO $$
DECLARE
  tenant_table text;
  policy_name text;
  expected_policy_count integer;
BEGIN
  FOR tenant_table IN
    SELECT unnest(ARRAY[
      'categories',
      'dishes',
      'orders',
      'payments',
      'upload_assets',
      'analytics_events',
      'platform_tracker_documents'
    ])
  LOOP
    expected_policy_count := 0;
    FOREACH policy_name IN ARRAY ARRAY['select', 'insert', 'update', 'delete']
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tenant_table
          AND policyname = format('%s_%s', tenant_table, policy_name)
      ) THEN
        expected_policy_count := expected_policy_count + 1;
      END IF;
    END LOOP;

    IF expected_policy_count <> 4 THEN
      RAISE EXCEPTION 'Missing expected CRUD policies on %', tenant_table;
    END IF;
  END LOOP;

  IF to_regclass('public.platform_configs') IS NULL THEN
    RAISE EXCEPTION 'platform_configs is missing; platform_tracker_documents global config split has not been applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_configs'
      AND policyname = 'platform_configs_admin_only'
  ) THEN
    RAISE EXCEPTION 'Missing admin-only policy on platform_configs';
  END IF;
END;
$$;

SELECT
  c.table_name,
  c.is_nullable,
  EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = format('public.%I', c.table_name)::regclass
      AND con.contype = 'f'
      AND pg_get_constraintdef(con.oid) ILIKE '%(restaurant_id)%REFERENCES restaurants(id)%'
  ) AS has_restaurant_fk,
  EXISTS (
    SELECT 1
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = c.table_name
      AND i.indexdef ILIKE '%restaurant_id%'
  ) AS has_restaurant_index
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  )
  AND c.column_name = 'restaurant_id'
ORDER BY c.table_name;

DO $$
DECLARE
  missing_restaurant_id_columns text[];
  nullable_restaurant_id_columns text[];
BEGIN
  SELECT array_agg(t.table_name ORDER BY t.table_name)
  INTO missing_restaurant_id_columns
  FROM (
    SELECT unnest(ARRAY[
      'categories',
      'dishes',
      'orders',
      'payments',
      'upload_assets',
      'analytics_events',
      'platform_tracker_documents'
    ]) AS table_name
  ) t
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = t.table_name
   AND c.column_name = 'restaurant_id'
  WHERE c.column_name IS NULL;

  IF missing_restaurant_id_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Missing restaurant_id column on: %', array_to_string(missing_restaurant_id_columns, ', ');
  END IF;

  SELECT array_agg(c.table_name ORDER BY c.table_name)
  INTO nullable_restaurant_id_columns
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN (
      'categories',
      'dishes',
      'orders',
      'payments',
      'upload_assets',
      'analytics_events',
      'platform_tracker_documents'
    )
    AND c.column_name = 'restaurant_id'
    AND c.is_nullable <> 'NO';

  IF nullable_restaurant_id_columns IS NOT NULL THEN
    RAISE EXCEPTION 'restaurant_id is still nullable on: %', array_to_string(nullable_restaurant_id_columns, ', ');
  END IF;
END;
$$;

-- ============================================================================
-- 2) Preconditions for tenant-isolation probes
-- Expected tenant IDs:
-- - Tenant A: 11111111-1111-1111-1111-111111111111
-- - Tenant B: 22222222-2222-2222-2222-222222222222
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = '11111111-1111-1111-1111-111111111111'
  ) THEN
    RAISE EXCEPTION 'Validation requires tenant A restaurant row with id 11111111-1111-1111-1111-111111111111';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = '22222222-2222-2222-2222-222222222222'
  ) THEN
    RAISE EXCEPTION 'Validation requires tenant B restaurant row with id 22222222-2222-2222-2222-222222222222';
  END IF;
END;
$$;

-- ============================================================================
-- 3) Helper contract sanity
-- ============================================================================
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
BEGIN
  IF app.current_restaurant_id() <> '11111111-1111-1111-1111-111111111111' THEN
    RAISE EXCEPTION 'app.current_restaurant_id() returned the wrong value';
  END IF;

  IF app.current_user_id() <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' THEN
    RAISE EXCEPTION 'app.current_user_id() returned the wrong value';
  END IF;

  IF app.is_admin() THEN
    RAISE EXCEPTION 'app.is_admin() should be false for the tenant probe';
  END IF;
END;
$$;
ROLLBACK;

-- ============================================================================
-- 4) Tenant isolation probes on categories
-- Uses one transaction and rolls probe rows back at the end.
-- ============================================================================
BEGIN;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO public.categories (id, restaurant_id, name, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000091', '11111111-1111-1111-1111-111111111111', 'RLS Probe Tenant A', 9001),
  ('20000000-0000-0000-0000-000000000091', '22222222-2222-2222-2222-222222222222', 'RLS Probe Tenant B', 9002)
ON CONFLICT (id) DO UPDATE
SET
  restaurant_id = EXCLUDED.restaurant_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
DECLARE
  visible_count integer;
  wrong_tenant_count integer;
BEGIN
  SELECT COUNT(*)
  INTO visible_count
  FROM public.categories
  WHERE id = '10000000-0000-0000-0000-000000000091';

  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A could not read its own category row';
  END IF;

  SELECT COUNT(*)
  INTO wrong_tenant_count
  FROM public.categories
  WHERE id = '20000000-0000-0000-0000-000000000091';

  IF wrong_tenant_count <> 0 THEN
    RAISE EXCEPTION 'Tenant A could read tenant B category row';
  END IF;
END;
$$;

INSERT INTO public.categories (id, restaurant_id, name, sort_order)
VALUES ('10000000-0000-0000-0000-000000000092', '11111111-1111-1111-1111-111111111111', 'RLS Probe Tenant A Insert', 9003);

DO $$
DECLARE
  inserted_count integer;
BEGIN
  SELECT COUNT(*)
  INTO inserted_count
  FROM public.categories
  WHERE id = '10000000-0000-0000-0000-000000000092';

  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A own-row insert did not persist';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.categories (id, restaurant_id, name, sort_order)
    VALUES ('20000000-0000-0000-0000-000000000092', '22222222-2222-2222-2222-222222222222', 'RLS Probe Cross Insert', 9004);
    RAISE EXCEPTION 'Tenant A cross-tenant insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR raise_exception THEN
      NULL;
  END;
END;
$$;

DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.categories
  SET name = 'Hacked'
  WHERE id = '20000000-0000-0000-0000-000000000091';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 0 THEN
    RAISE EXCEPTION 'Tenant A updated tenant B row';
  END IF;
END;
$$;

DO $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.categories
  WHERE id = '20000000-0000-0000-0000-000000000091';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 0 THEN
    RAISE EXCEPTION 'Tenant A deleted tenant B row';
  END IF;
END;
$$;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

DO $$
DECLARE
  admin_visible_count integer;
BEGIN
  SELECT COUNT(*)
  INTO admin_visible_count
  FROM public.categories
  WHERE id IN (
    '10000000-0000-0000-0000-000000000091',
    '20000000-0000-0000-0000-000000000091'
  );

  IF admin_visible_count <> 2 THEN
    RAISE EXCEPTION 'Admin could not read both tenant probe rows';
  END IF;
END;
$$;

ROLLBACK;

-- ============================================================================
-- 5) Missing tenant context must fail closed
-- ============================================================================
BEGIN;
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);
RESET app.restaurant_id;

DO $$
BEGIN
  BEGIN
    PERFORM app.current_restaurant_id();
    RAISE EXCEPTION 'Missing app.restaurant_id unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      NULL;
  END;
END;
$$;
ROLLBACK;

-- ============================================================================
-- 6) Trigger stamping still works for same-tenant writes
-- ============================================================================
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
DECLARE
  stamped_restaurant_id text;
BEGIN
  INSERT INTO public.categories (id, name, sort_order)
  VALUES ('10000000-0000-0000-0000-000000000093', 'RLS Trigger Probe', 9005)
  RETURNING restaurant_id INTO stamped_restaurant_id;

  IF stamped_restaurant_id <> '11111111-1111-1111-1111-111111111111' THEN
    RAISE EXCEPTION 'Trigger did not stamp restaurant_id from session';
  END IF;
END;
$$;
ROLLBACK;

-- ============================================================================
-- 7) App-level critical flow test paths
-- ============================================================================
SELECT *
FROM (
  VALUES
    ('rls_preflight_same_role', 'npm run rls:preflight'),
    ('rls_sql_validation', 'npm run rls:validate'),
    ('rls_backend_session_contract', 'npm run rls:validate:backend'),
    ('rls_payment_callback_live', 'npm --prefix backend run rls:validate:callback'),
    ('public_storefront', 'npm --prefix backend run test -- public-storefront.service.test.ts'),
    ('db_tenant_context', 'npm --prefix backend run test -- db-rls-context.test.ts'),
    ('payment_callback_idempotency', 'npm --prefix backend run test -- payment.service.test.ts'),
    ('frontend_storefront_build', 'npm run build')
) AS flow_checks(flow_name, test_path)
ORDER BY flow_name;
