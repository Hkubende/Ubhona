-- Ubhona Prisma / DB alignment for payments.restaurant_id
--
-- Purpose:
-- - align the Payment model with the tenant-scoped PostgreSQL security model
-- - ensure payments has a native restaurant_id before callback-path validation
-- - keep payments on canonical tenant CRUD policies even if this file is applied
--   independently of the broader rollout
--
-- Notes:
-- - this environment still stores ids as text; this alignment is type-compatible
--   with public.restaurants(id) and public.orders(restaurant_id)
-- - fail closed if any payment row cannot be mapped to an order-owned restaurant

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.require_text_setting(setting_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_value text;
BEGIN
  raw_value := nullif(btrim(current_setting(setting_name, true)), '');
  IF raw_value IS NULL THEN
    RAISE EXCEPTION 'Missing required session setting: %', setting_name
      USING ERRCODE = '22023';
  END IF;
  RETURN raw_value;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_restaurant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT app.require_text_setting('app.restaurant_id');
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT app.require_text_setting('app.user_id');
$$;

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

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS restaurant_id text;

COMMENT ON COLUMN public.payments.restaurant_id IS
  'Canonical tenant key for payment RLS and ORM alignment. Backfilled from orders.restaurant_id.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE restaurant_id IS NULL
       OR btrim(restaurant_id::text) = ''
  ) THEN
    RAISE EXCEPTION
      'orders.restaurant_id contains NULL or blank values; refusing payments.restaurant_id backfill';
  END IF;
END;
$$;

UPDATE public.payments p
SET restaurant_id = nullif(btrim(o.restaurant_id::text), '')
FROM public.orders o
WHERE p.order_id = o.id
  AND p.restaurant_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE restaurant_id IS NULL
       OR btrim(restaurant_id) = ''
  ) THEN
    RAISE EXCEPTION
      'payments.restaurant_id backfill incomplete; refusing Prisma/DB alignment';
  END IF;
END;
$$;

ALTER TABLE public.payments
ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_restaurant_id_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES public.restaurants(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS payments_restaurant_id_idx
  ON public.payments (restaurant_id);

CREATE INDEX IF NOT EXISTS payments_restaurant_id_created_at_idx
  ON public.payments (restaurant_id, created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
DROP POLICY IF EXISTS payments_delete ON public.payments;

CREATE POLICY payments_select
ON public.payments
FOR SELECT
USING (app.is_admin() OR restaurant_id = app.current_restaurant_id());

CREATE POLICY payments_insert
ON public.payments
FOR INSERT
WITH CHECK (app.is_admin() OR restaurant_id = app.current_restaurant_id());

CREATE POLICY payments_update
ON public.payments
FOR UPDATE
USING (app.is_admin() OR restaurant_id = app.current_restaurant_id())
WITH CHECK (app.is_admin() OR restaurant_id = app.current_restaurant_id());

CREATE POLICY payments_delete
ON public.payments
FOR DELETE
USING (app.is_admin() OR restaurant_id = app.current_restaurant_id());

COMMIT;
