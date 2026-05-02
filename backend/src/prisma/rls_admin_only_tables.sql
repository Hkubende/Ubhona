-- Ubhona admin-only table RLS
--
-- These tables are treated differently from tenant-scoped tables:
-- - they are platform-administration surfaces, not restaurant-owned data
-- - tenant restaurant_id logic is intentionally excluded
-- - access is granted only when app.is_admin() returns true
--
-- Assumptions from current schema audit:
-- - audit_logs exists
-- - admin_users may not exist
-- - platform_configs may not exist
--
-- The migration is guarded so missing tables do not break deployment.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS audit_logs_admin_only ON audit_logs;
    CREATE POLICY audit_logs_admin_only
    ON audit_logs
    FOR ALL
    USING (app.is_admin())
    WITH CHECK (app.is_admin());
  END IF;

  IF to_regclass('public.admin_users') IS NOT NULL THEN
    ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS admin_users_admin_only ON admin_users;
    CREATE POLICY admin_users_admin_only
    ON admin_users
    FOR ALL
    USING (app.is_admin())
    WITH CHECK (app.is_admin());
  END IF;

  IF to_regclass('public.platform_configs') IS NOT NULL THEN
    ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE platform_configs FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS platform_configs_admin_only ON platform_configs;
    CREATE POLICY platform_configs_admin_only
    ON platform_configs
    FOR ALL
    USING (app.is_admin())
    WITH CHECK (app.is_admin());
  END IF;
END;
$$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Validation SQL
-- ---------------------------------------------------------------------------

-- 1. Show RLS state and admin-only policies for the candidate tables.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  p.policyname,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_class c
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('audit_logs', 'admin_users', 'platform_configs')
ORDER BY c.relname, p.policyname NULLS LAST;

-- 2. Admin read/write probe using audit_logs if it exists.
-- Expected:
-- - succeeds only when app.is_admin = true
-- - this probe assumes app.user_id is a valid existing users.id for actor_user_id
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'true', true);

-- Adjust actor_user_id to a real user id before running in a live database.
INSERT INTO audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, metadata_json)
VALUES (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'platform_admin',
  'admin_rls_probe',
  'system',
  'admin-probe',
  '{}'::jsonb
);

SELECT id, actor_user_id, action, target_type, target_id
FROM audit_logs
ORDER BY created_at DESC
LIMIT 5;
ROLLBACK;

-- 3. Non-admin read/write denial probe using audit_logs if it exists.
-- Expected:
-- - INSERT denied
-- - SELECT returns zero visible rows (or errors, depending on caller setup)
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'false', true);

INSERT INTO audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, metadata_json)
VALUES (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'platform_admin',
  'non_admin_rls_probe',
  'system',
  'non-admin-probe',
  '{}'::jsonb
);

SELECT id, actor_user_id, action, target_type, target_id
FROM audit_logs
ORDER BY created_at DESC
LIMIT 5;
ROLLBACK;
