-- Ubhona tenant session contract
--
-- This migration defines a small, explicit helper API under the `app` schema
-- for PostgreSQL Row Level Security policies and tenant-aware SQL code.
--
-- Fail-closed behavior matters for tenant isolation:
-- if tenant or user context is missing, blank, or malformed, the helpers must
-- not silently broaden access. Instead, they raise for required UUID context
-- and return false for admin checks.

CREATE SCHEMA IF NOT EXISTS app;

COMMENT ON SCHEMA app IS
  'Application-owned SQL helpers for tenant/session context and RLS policy evaluation.';

CREATE OR REPLACE FUNCTION app.require_uuid_setting(setting_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_value text;
BEGIN
  raw_value := nullif(btrim(current_setting(setting_name, true)), '');

  -- Fail closed: a missing or blank tenant/user context must not be treated as
  -- "all tenants" or "anonymous success" during policy checks.
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

COMMENT ON FUNCTION app.require_uuid_setting(text) IS
  'Returns a required UUID session setting. Fails closed if the setting is missing, blank, or not a valid UUID.';

CREATE OR REPLACE FUNCTION app.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT app.require_uuid_setting('app.restaurant_id');
$$;

COMMENT ON FUNCTION app.current_restaurant_id() IS
  'Returns the current tenant restaurant UUID from app.restaurant_id. Fails closed when tenant context is missing.';

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT app.require_uuid_setting('app.user_id');
$$;

COMMENT ON FUNCTION app.current_user_id() IS
  'Returns the current authenticated user UUID from app.user_id. Fails closed when user context is missing.';

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

COMMENT ON FUNCTION app.is_admin() IS
  'Returns true only for explicit truthy app.is_admin values. Missing, blank, or malformed values fail closed to false.';

-- Example usage in application transactions:
--
-- SELECT set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
-- SELECT set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
-- SELECT set_config('app.is_admin', 'false', true);
--
-- Then policies and SQL helpers can safely reference:
-- SELECT app.current_restaurant_id();
-- SELECT app.current_user_id();
-- SELECT app.is_admin();

-- Validation block:
-- prove the helpers parse valid values and return strongly typed results.
DO $$
DECLARE
  checked_restaurant_id uuid;
  checked_user_id uuid;
  checked_is_admin boolean;
BEGIN
  PERFORM set_config('app.restaurant_id', '11111111-1111-1111-1111-111111111111', true);
  PERFORM set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
  PERFORM set_config('app.is_admin', 'true', true);

  checked_restaurant_id := app.current_restaurant_id();
  checked_user_id := app.current_user_id();
  checked_is_admin := app.is_admin();

  IF checked_restaurant_id <> '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION 'app.current_restaurant_id() validation failed';
  END IF;

  IF checked_user_id <> '22222222-2222-2222-2222-222222222222'::uuid THEN
    RAISE EXCEPTION 'app.current_user_id() validation failed';
  END IF;

  IF checked_is_admin IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'app.is_admin() validation failed';
  END IF;
END;
$$;

-- Pooled environment note:
-- use transaction-local settings (`set_config(..., true)` or `SET LOCAL`) inside
-- the same transaction as the protected queries. This prevents tenant context
-- from leaking across reused pooled connections.
