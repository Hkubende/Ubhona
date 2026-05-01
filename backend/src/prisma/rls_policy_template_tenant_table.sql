-- Ubhona canonical RLS policy template for tenant-scoped tables
--
-- Scope:
-- - tables with a native `restaurant_id` column
-- - tenant access is granted when restaurant_id matches app.current_restaurant_id()
-- - platform-admin access is granted when app.is_admin() returns true
--
-- This file is a template only. Replace __TABLE_NAME__ with a concrete table
-- name when applying policies to a real table.

-- ---------------------------------------------------------------------------
-- Policy naming convention
--
--   rls_<table>_<action>
--
-- Examples:
--   rls_categories_select
--   rls_categories_insert
--   rls_categories_update
--   rls_categories_delete
--
-- Deterministic naming keeps future migrations, audits, and DROP POLICY /
-- CREATE POLICY replacements predictable.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- SELECT
--
-- Read access is allowed when:
-- - the session is platform-admin, or
-- - the row belongs to the current tenant restaurant
-- ---------------------------------------------------------------------------
CREATE POLICY rls___TABLE_NAME___select
ON __TABLE_NAME__
FOR SELECT
USING (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

-- ---------------------------------------------------------------------------
-- INSERT
--
-- INSERT must use WITH CHECK because there is no existing row to evaluate with
-- USING. The database must validate the ownership of the new row being written.
-- Relying on USING alone would leave new-row ownership unchecked.
-- ---------------------------------------------------------------------------
CREATE POLICY rls___TABLE_NAME___insert
ON __TABLE_NAME__
FOR INSERT
WITH CHECK (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

-- ---------------------------------------------------------------------------
-- UPDATE
--
-- UPDATE needs both USING and WITH CHECK:
-- - USING controls which existing rows may be targeted for update
-- - WITH CHECK controls what the updated row is allowed to become
--
-- Without USING, a tenant could potentially target rows they should not touch.
-- Without WITH CHECK, a tenant might update one of their own rows so that its
-- restaurant_id changes to another tenant, effectively moving data across
-- tenant boundaries.
-- ---------------------------------------------------------------------------
CREATE POLICY rls___TABLE_NAME___update
ON __TABLE_NAME__
FOR UPDATE
USING (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
)
WITH CHECK (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);

-- ---------------------------------------------------------------------------
-- DELETE
--
-- Delete access is evaluated only against the existing row, so USING is the
-- correct clause.
-- ---------------------------------------------------------------------------
CREATE POLICY rls___TABLE_NAME___delete
ON __TABLE_NAME__
FOR DELETE
USING (
  app.is_admin()
  OR restaurant_id = app.current_restaurant_id()
);
