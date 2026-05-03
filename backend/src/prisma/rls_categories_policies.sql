-- Ubhona RLS policies for categories
--
-- Scope:
-- - categories only
-- - admin access is allowed through app.is_admin()
-- - tenant access is allowed only when categories.restaurant_id matches
--   app.current_restaurant_id()
--
-- This migration safely drops prior categories policies before recreating the
-- canonical CRUD set.

BEGIN;

-- Drop existing policy names safely so the migration can be rerun after policy
-- edits without leaving stale definitions behind.
DROP POLICY IF EXISTS categories_select ON categories;
DROP POLICY IF EXISTS categories_insert ON categories;
DROP POLICY IF EXISTS categories_update ON categories;
DROP POLICY IF EXISTS categories_delete ON categories;

-- SELECT:
-- Read is allowed only for platform-admin sessions or rows owned by the active
-- tenant restaurant.
CREATE POLICY categories_select
ON categories
FOR SELECT
USING (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

-- INSERT:
-- New rows must be written either by an admin session or with restaurant_id set
-- to the active tenant. WITH CHECK protects the new row being inserted.
CREATE POLICY categories_insert
ON categories
FOR INSERT
WITH CHECK (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

-- UPDATE:
-- USING restricts which existing rows may be targeted.
-- WITH CHECK prevents a tenant from rewriting a row so that it changes
-- ownership to another restaurant.
CREATE POLICY categories_update
ON categories
FOR UPDATE
USING (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
)
WITH CHECK (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

-- DELETE:
-- Delete is allowed only for admin sessions or rows owned by the active tenant.
CREATE POLICY categories_delete
ON categories
FOR DELETE
USING (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Validation SQL
-- ---------------------------------------------------------------------------

-- 1. Show policies currently attached to categories.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'categories'
ORDER BY policyname;

-- 2. Tenant read test.
-- Replace the UUID with a real tenant restaurant id from your environment.
-- Expected result:
-- - returns only categories whose restaurant_id matches the session tenant
-- - returns all rows if app.is_admin is set to true
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'false', true);

SELECT id, restaurant_id, name
FROM categories
ORDER BY created_at DESC
LIMIT 20;
ROLLBACK;

-- 3. Cross-tenant insert denial scenario.
-- Replace the UUIDs with valid ids from your environment:
-- - first UUID = active tenant restaurant
-- - second UUID = some other restaurant
--
-- Expected result:
-- - INSERT is rejected because WITH CHECK does not allow writing another
--   tenant's restaurant_id while app.is_admin = false
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'false', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES (
  gen_random_uuid(),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'Cross-tenant denial probe',
  999
);
ROLLBACK;
