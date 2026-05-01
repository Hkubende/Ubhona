-- Ubhona PlatformTrackerDocument ORM / DB alignment
--
-- Goal:
-- - classify platform_tracker_documents as a tenant-scoped table
-- - move the global roadmap/config document into platform_configs
-- - ensure the tenant table has restaurant_id, canonical CRUD tenant policies,
--   and no hidden admin-only exception shape
--
-- Assumptions:
-- - this environment stores tenant ids as text
-- - global admin-only config data belongs in platform_configs, not in the
--   tenant-scoped platform_tracker_documents table

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

CREATE TABLE IF NOT EXISTS public.platform_configs (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_configs IS
  'Admin-only global config documents. Used for non-tenant platform settings and roadmap state.';

CREATE INDEX IF NOT EXISTS platform_configs_updated_at_idx
  ON public.platform_configs (updated_at DESC);

ALTER TABLE public.platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_configs_admin_only ON public.platform_configs;
CREATE POLICY platform_configs_admin_only
ON public.platform_configs
FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

ALTER TABLE public.platform_tracker_documents
ADD COLUMN IF NOT EXISTS restaurant_id text;

COMMENT ON COLUMN public.platform_tracker_documents.restaurant_id IS
  'Canonical tenant key for platform tracker document RLS and ORM alignment.';

INSERT INTO public.platform_configs (id, key, payload)
SELECT d.id, d.key, d.payload::jsonb
FROM public.platform_tracker_documents d
WHERE d.key = 'menuvista-platform-roadmap'
ON CONFLICT (key) DO UPDATE
SET payload = EXCLUDED.payload,
    updated_at = now();

DELETE FROM public.platform_tracker_documents
WHERE key = 'menuvista-platform-roadmap';

UPDATE public.platform_tracker_documents d
SET restaurant_id = split_part(d.key, ':', 2)
WHERE d.restaurant_id IS NULL
  AND btrim(split_part(d.key, ':', 2)) <> ''
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = split_part(d.key, ':', 2)
  );

UPDATE public.platform_tracker_documents d
SET restaurant_id = nullif(btrim(d.payload::jsonb ->> 'restaurantId'), '')
WHERE d.restaurant_id IS NULL
  AND nullif(btrim(d.payload::jsonb ->> 'restaurantId'), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = nullif(btrim(d.payload::jsonb ->> 'restaurantId'), '')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.platform_tracker_documents
    WHERE restaurant_id IS NULL
       OR btrim(restaurant_id) = ''
  ) THEN
    RAISE EXCEPTION
      'platform_tracker_documents.restaurant_id still contains NULL or blank values; refusing Prisma alignment';
  END IF;
END;
$$;

ALTER TABLE public.platform_tracker_documents
ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_tracker_documents_restaurant_id_fkey'
      AND conrelid = 'public.platform_tracker_documents'::regclass
  ) THEN
    ALTER TABLE public.platform_tracker_documents
      ADD CONSTRAINT platform_tracker_documents_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES public.restaurants(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS platform_tracker_documents_restaurant_id_idx
  ON public.platform_tracker_documents (restaurant_id);

CREATE INDEX IF NOT EXISTS platform_tracker_documents_restaurant_updated_idx
  ON public.platform_tracker_documents (restaurant_id, updated_at DESC);

ALTER TABLE public.platform_tracker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tracker_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_tracker_documents_admin_only ON public.platform_tracker_documents;
DROP POLICY IF EXISTS platform_tracker_documents_select ON public.platform_tracker_documents;
DROP POLICY IF EXISTS platform_tracker_documents_insert ON public.platform_tracker_documents;
DROP POLICY IF EXISTS platform_tracker_documents_update ON public.platform_tracker_documents;
DROP POLICY IF EXISTS platform_tracker_documents_delete ON public.platform_tracker_documents;

CREATE POLICY platform_tracker_documents_select
ON public.platform_tracker_documents
FOR SELECT
USING (app.is_admin() OR restaurant_id = app.current_restaurant_id());

CREATE POLICY platform_tracker_documents_insert
ON public.platform_tracker_documents
FOR INSERT
WITH CHECK (app.is_admin() OR restaurant_id = app.current_restaurant_id());

CREATE POLICY platform_tracker_documents_update
ON public.platform_tracker_documents
FOR UPDATE
USING (app.is_admin() OR restaurant_id = app.current_restaurant_id())
WITH CHECK (app.is_admin() OR restaurant_id = app.current_restaurant_id());

CREATE POLICY platform_tracker_documents_delete
ON public.platform_tracker_documents
FOR DELETE
USING (app.is_admin() OR restaurant_id = app.current_restaurant_id());

COMMIT;
