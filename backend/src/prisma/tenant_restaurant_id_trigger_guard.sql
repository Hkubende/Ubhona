-- Ubhona tenant restaurant_id trigger guard
--
-- This migration adds a reusable trigger function and attaches it to the
-- tenant-scoped tables listed below.
--
-- Why this exists in addition to RLS:
-- - RLS is the primary database boundary for tenant isolation.
-- - This trigger is a second line of defense for writes: it stamps missing
--   restaurant_id values from session context and rejects cross-tenant writes
--   before they persist.
-- - Defense in depth matters for multi-tenant SaaS systems, especially during
--   rollout phases where app code, migrations, and policies may not evolve at
--   exactly the same pace.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.set_restaurant_id_from_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_restaurant_id text;
BEGIN
  -- Admin sessions are allowed to write across tenants, but we still stamp
  -- NULL restaurant_id from the active session when available for consistency.
  session_restaurant_id := app.current_restaurant_id();

  IF NEW.restaurant_id IS NULL THEN
    NEW.restaurant_id := session_restaurant_id;
  END IF;

  IF NOT app.is_admin() AND NEW.restaurant_id IS DISTINCT FROM session_restaurant_id THEN
    RAISE EXCEPTION
      'Cross-tenant write denied on %.%: restaurant_id % does not match session tenant %',
      TG_TABLE_SCHEMA,
      TG_TABLE_NAME,
      NEW.restaurant_id,
      session_restaurant_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.set_restaurant_id_from_session() IS
  'Second-line tenant write guard. Stamps NULL restaurant_id from session context and rejects cross-tenant writes for non-admin sessions.';

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_categories_set_restaurant_id_from_session ON categories;
CREATE TRIGGER trg_categories_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

-- ---------------------------------------------------------------------------
-- dishes
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_dishes_set_restaurant_id_from_session ON dishes;
CREATE TRIGGER trg_dishes_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON dishes
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_set_restaurant_id_from_session ON orders;
CREATE TRIGGER trg_orders_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_payments_set_restaurant_id_from_session ON payments;
CREATE TRIGGER trg_payments_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

-- ---------------------------------------------------------------------------
-- upload_assets
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_upload_assets_set_restaurant_id_from_session ON upload_assets;
CREATE TRIGGER trg_upload_assets_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON upload_assets
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

-- ---------------------------------------------------------------------------
-- analytics_events
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_analytics_events_set_restaurant_id_from_session ON analytics_events;
CREATE TRIGGER trg_analytics_events_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON analytics_events
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

-- ---------------------------------------------------------------------------
-- platform_tracker_documents
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_platform_tracker_documents_set_restaurant_id_from_session ON platform_tracker_documents;
CREATE TRIGGER trg_platform_tracker_documents_set_restaurant_id_from_session
BEFORE INSERT OR UPDATE ON platform_tracker_documents
FOR EACH ROW
EXECUTE FUNCTION app.set_restaurant_id_from_session();

COMMIT;

-- ---------------------------------------------------------------------------
-- Validation SQL
-- Replace UUIDs and required non-tenant columns with valid values from your
-- environment before execution.
-- ---------------------------------------------------------------------------

-- 1. INSERT without restaurant_id:
-- Expected: NEW.restaurant_id is stamped from app.current_restaurant_id().
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'false', true);

INSERT INTO categories (id, name, sort_order)
VALUES (
  gen_random_uuid(),
  'Trigger stamp probe',
  1
)
RETURNING id, restaurant_id, name, sort_order;
ROLLBACK;

-- 2. INSERT with same-tenant restaurant_id:
-- Expected: succeeds for non-admin because NEW.restaurant_id matches session tenant.
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'false', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  'Same tenant probe',
  2
)
RETURNING id, restaurant_id, name, sort_order;
ROLLBACK;

-- 3. INSERT with cross-tenant restaurant_id:
-- Expected: fails with a cross-tenant write denied exception for non-admin sessions.
BEGIN;
SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.is_admin', 'false', true);

INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES (
  gen_random_uuid(),
  '33333333-3333-3333-3333-333333333333',
  'Cross tenant denial probe',
  3
);
ROLLBACK;
