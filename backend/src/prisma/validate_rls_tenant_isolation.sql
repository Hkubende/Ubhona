-- Ubhona RLS tenant-isolation validation script
--
-- How to use:
-- - Run this manually against a non-production test database using the same DB
--   role as the application, not a superuser.
-- - This script assumes the Ubhona session helpers already exist:
--   app.current_restaurant_id(), app.current_user_id(), app.is_admin()
-- - This script also assumes tenant CRUD RLS is already enabled on
--   public.categories and that restaurants with the two example tenant ids
--   already exist, otherwise the categories foreign key will reject inserts.
-- - Every scenario runs in its own BEGIN/ROLLBACK block so the script leaves
--   no permanent test data behind.

-- Fixed validation identities used throughout the script.
-- Tenant A: 11111111-1111-1111-1111-111111111111
-- Tenant B: 22222222-2222-2222-2222-222222222222
-- User A:   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Admin:    bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb

-- ----------------------------------------------------------------------------
-- Scenario 1: Tenant A reads only A rows
-- Expected:
-- - Tenant A sees exactly the A probe row
-- - Tenant A does not see the B probe row
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'RLS Probe A Read', 9001),
  ('20000000-0000-0000-0000-000000000001'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'RLS Probe B Hidden', 9002);

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
DECLARE
  visible_count integer;
  tenant_b_visible boolean;
BEGIN
  SELECT count(*)
  INTO visible_count
  FROM categories
  WHERE id IN (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000001'::uuid
  );

  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'Scenario 1 failed: expected Tenant A to see exactly 1 probe row, saw %', visible_count;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM categories
    WHERE id = '20000000-0000-0000-0000-000000000001'::uuid
  )
  INTO tenant_b_visible;

  IF tenant_b_visible THEN
    RAISE EXCEPTION 'Scenario 1 failed: Tenant A can see Tenant B row';
  END IF;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 2: Tenant A cannot read B rows
-- Expected:
-- - direct lookup for the B probe row returns zero rows
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES ('20000000-0000-0000-0000-000000000002'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'RLS Probe B Direct Read', 9003);

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT count(*)
  INTO row_count
  FROM categories
  WHERE id = '20000000-0000-0000-0000-000000000002'::uuid;

  IF row_count <> 0 THEN
    RAISE EXCEPTION 'Scenario 2 failed: Tenant A read Tenant B row count %', row_count;
  END IF;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 3: Tenant A inserts a valid A row
-- Expected:
-- - INSERT succeeds
-- - inserted row is visible to Tenant A
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES ('10000000-0000-0000-0000-000000000003'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'RLS Probe A Insert', 9004);

DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT count(*)
  INTO row_count
  FROM categories
  WHERE id = '10000000-0000-0000-0000-000000000003'::uuid;

  IF row_count <> 1 THEN
    RAISE EXCEPTION 'Scenario 3 failed: Tenant A insert did not persist as visible same-tenant row';
  END IF;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 4: Tenant A cannot insert a B-owned row
-- Expected:
-- - INSERT fails due to RLS WITH CHECK or trigger guard
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO categories (id, restaurant_id, name, sort_order)
    VALUES ('20000000-0000-0000-0000-000000000004'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'RLS Probe B Insert Denial', 9005);

    RAISE EXCEPTION 'Scenario 4 failed: cross-tenant INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('row-level security' IN lower(SQLERRM)) = 0
         AND position('tenant' IN lower(SQLERRM)) = 0
         AND position('restaurant_id' IN lower(SQLERRM)) = 0 THEN
        RAISE EXCEPTION 'Scenario 4 failed with unexpected error: %', SQLERRM;
      END IF;
  END;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 5: Tenant A cannot update a B row
-- Expected:
-- - UPDATE affects zero rows or raises due to RLS/guard
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES ('20000000-0000-0000-0000-000000000005'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'RLS Probe B Update Denial', 9006);

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE categories
  SET name = 'Tenant A should not update this'
  WHERE id = '20000000-0000-0000-0000-000000000005'::uuid;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 0 THEN
    RAISE EXCEPTION 'Scenario 5 failed: Tenant A updated % Tenant B row(s)', updated_count;
  END IF;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 6: Tenant A cannot delete a B row
-- Expected:
-- - DELETE affects zero rows or raises due to RLS/guard
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES ('20000000-0000-0000-0000-000000000006'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'RLS Probe B Delete Denial', 9007);

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);

DO $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM categories
  WHERE id = '20000000-0000-0000-0000-000000000006'::uuid;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count <> 0 THEN
    RAISE EXCEPTION 'Scenario 6 failed: Tenant A deleted % Tenant B row(s)', deleted_count;
  END IF;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 7: Admin can read across tenants
-- Expected:
-- - admin session sees both tenant rows
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000007'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'RLS Probe Admin A', 9008),
  ('20000000-0000-0000-0000-000000000007'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'RLS Probe Admin B', 9009);

DO $$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*)
  INTO visible_count
  FROM categories
  WHERE id IN (
    '10000000-0000-0000-0000-000000000007'::uuid,
    '20000000-0000-0000-0000-000000000007'::uuid
  );

  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'Scenario 7 failed: admin should see 2 rows across tenants, saw %', visible_count;
  END IF;
END;
$$;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- Scenario 8: Missing app.restaurant_id fails closed
-- Expected:
-- - tenant-scoped read fails because app.current_restaurant_id() raises
-- ----------------------------------------------------------------------------
BEGIN;

SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('app.is_admin', 'false', true);
SELECT set_config('app.restaurant_id', '', true);

DO $$
BEGIN
  BEGIN
    PERFORM 1
    FROM categories
    LIMIT 1;

    RAISE EXCEPTION 'Scenario 8 failed: missing app.restaurant_id did not fail closed';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('missing required session setting' IN lower(SQLERRM)) = 0
         AND position('invalid uuid' IN lower(SQLERRM)) = 0
         AND position('app.restaurant_id' IN lower(SQLERRM)) = 0 THEN
        RAISE EXCEPTION 'Scenario 8 failed with unexpected error: %', SQLERRM;
      END IF;
  END;
END;
$$;

ROLLBACK;
