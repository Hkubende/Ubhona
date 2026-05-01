-- Ubhona tenant-table RLS activation
--
-- This migration enables Row Level Security and forces it on all confirmed
-- tenant-scoped tables. Policies are intentionally not created in this step.
--
-- FORCE ROW LEVEL SECURITY matters because it keeps table owners and other
-- elevated-but-non-superuser roles from bypassing tenant filters accidentally.
-- For a multi-tenant SaaS, fail-closed behavior at the database boundary is the
-- safer default.

BEGIN;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes FORCE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

ALTER TABLE upload_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_assets FORCE ROW LEVEL SECURITY;

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events FORCE ROW LEVEL SECURITY;

ALTER TABLE platform_tracker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tracker_documents FORCE ROW LEVEL SECURITY;

COMMIT;

-- Validation query:
-- confirms which target tables have RLS enabled and forced.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'categories',
    'dishes',
    'orders',
    'payments',
    'upload_assets',
    'analytics_events',
    'platform_tracker_documents'
  )
ORDER BY c.relname;

-- Testing note:
-- verify behavior using the same database role the application uses, not only a
-- superuser session. Superusers bypass RLS, so superuser-only checks can give a
-- false sense of safety.
