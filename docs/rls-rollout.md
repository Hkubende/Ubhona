# Ubhona PostgreSQL RLS Rollout

Last updated: 2026-04-18

This runbook operationalizes the Ubhona PostgreSQL RLS rollout across local/dev, staging, and production.

## Source Files

- Apply migration: `backend/src/prisma/rls_rollout_consolidated.sql`
- Validation: `backend/src/prisma/rls_rollout_validate.sql`
- Runner: `backend/scripts/rls-rollout.mjs`

## Commands

From repo root:

```bash
npm run rls:preflight
npm run rls:apply
npm run rls:validate
npm run rls:validate:backend
npm run rls:validate:full
```

From `backend/`:

```bash
npm run rls:preflight
npm run rls:apply
npm run rls:validate
npm run rls:validate:backend
npm run rls:validate:full
```

Database URL resolution order:

Preflight/validate:

1. `APP_RUNTIME_DATABASE_URL`

`DATABASE_URL` fallback is intentionally not accepted for runtime-equivalent RLS validation.

Apply:

1. `--database-url-env=VAR`
2. `RLS_APPLY_DATABASE_URL`
3. `RLS_DATABASE_URL`
4. `APP_RUNTIME_DATABASE_URL`
5. `DATABASE_URL`

Use the same non-privileged database role as the application for preflight/validate.
Do not validate only as a superuser, service role, owner-bypass path, or any role with `BYPASSRLS`.
`npm run rls:preflight` now fails if the connected role is `SUPERUSER` or has `BYPASSRLS`.
Use `--allow-privileged-role` only for controlled diagnostics, not normal rollout validation.
`npm run rls:apply` may use a separate apply/migration role, but it now prints full role-audit evidence before SQL runs.

## Validation Evidence Contract

`npm run rls:audit:validate`, `npm run rls:preflight`, `npm run rls:validate`, and `npm run rls:validate:backend` now report the same runtime-equivalent role evidence fields:

- `envName`
- `connectionIdentity`
- `current_user`
- `session_user`
- `rolsuper`
- `rolbypassrls`
- `ownedTargetTables`
- `targetTables`
  - `table_name`
  - `owner`
  - `rls_enabled`
  - `rls_forced`
- `usesRequiredRuntimeEnv`
- `appSafeForValidation`

Standard validation fails hard when any of these conditions are true:

- `APP_RUNTIME_DATABASE_URL` is missing
- validation tries to use plain `DATABASE_URL`
- `rolsuper=true`
- `rolbypassrls=true`
- `usesRequiredRuntimeEnv=false`
- `appSafeForValidation=false`

## Role Model

- Apply role:
  - may be separate from runtime
  - can own tables or have stronger DDL privileges
  - must not be used to prove tenant isolation behavior
- Runtime role:
  - same role used by the backend application
  - must not be `SUPERUSER`
  - must not have `BYPASSRLS`
  - should be configured through `APP_RUNTIME_DATABASE_URL`
- Validation role:
  - same as runtime or permission-equivalent
  - must not be `SUPERUSER`
  - must not have `BYPASSRLS`
  - if it owns any tenant tables, those tables must have `FORCE ROW LEVEL SECURITY`
  - standard rollout validation now uses `APP_RUNTIME_DATABASE_URL` directly

Role audit commands:

```bash
npm run rls:audit:apply
npm run rls:audit:validate
```

## Apply Plan

Exact order of operations:

1. Set `APP_RUNTIME_DATABASE_URL` to the non-privileged runtime-equivalent DB role.
2. Run `npm run rls:audit:validate` and confirm:
   - `rolsuper=false`
   - `rolbypassrls=false`
   - `usesRequiredRuntimeEnv=true`
   - `appSafeForValidation=true`
   - any owned tenant tables show `rls_forced=true`
3. Run `npm run rls:preflight` and confirm the target DB and role are the intended runtime-equivalent identity.
4. If apply needs a separate role, run `npm run rls:audit:apply` and confirm that role is the intended migration/apply identity.
5. Apply `backend/src/prisma/rls_rollout_consolidated.sql` with `npm run rls:apply`.
6. Run SQL validation with `npm run rls:validate`.
7. Run backend session-contract validation with `npm run rls:validate:backend`.
8. Run critical app flow checks:
   - `npm --prefix backend run test`
   - `npm run build`

Success criteria:
- preflight rejects privileged roles and shows the intended app-equivalent role
- role audit proves validation role does not bypass RLS
- role audit proves validation used `APP_RUNTIME_DATABASE_URL`
- apply completes without SQL errors
- SQL validation completes without exceptions
- backend contract validation confirms `app.restaurant_id`, `app.user_id`, and `app.is_admin`
- critical flows continue to function after rollout

## Local / Dev

### Preflight checks

1. Point `APP_RUNTIME_DATABASE_URL` at the non-privileged runtime-equivalent role.
2. If apply needs a separate role, set `RLS_APPLY_DATABASE_URL`.
3. Leave `RLS_VALIDATE_DATABASE_URL` unset for standard rollout validation.
4. Do not rely on `DATABASE_URL` for RLS validation. The rollout commands now fail hard if only `DATABASE_URL` is present.
5. Ensure tenant fixtures exist for:
   - `11111111-1111-1111-1111-111111111111`
   - `22222222-2222-2222-2222-222222222222`
6. Regenerate Prisma client if schema changes were pulled:

```bash
npm --prefix backend run prisma:generate
```

7. Audit the runtime-equivalent role:

```bash
npm run rls:audit:validate
```

8. Run connection preflight:

```bash
npm run rls:preflight
```

If you are intentionally diagnosing with a privileged role, use:

```bash
node backend/scripts/rls-rollout.mjs preflight --allow-privileged-role
```

### Apply

```bash
npm run rls:audit:apply
npm run rls:apply
```

### Post-apply validation

```bash
npm run rls:validate
npm run rls:validate:backend
npm --prefix backend run test
npm run build
```

Required PASS signals:
- `rls:audit:validate` reports `usesRequiredRuntimeEnv=true`
- `rls:validate` completes without SQL exceptions
- `rls:validate:backend` confirms the runtime session contract and fail-closed behavior
- `rls:audit:validate` proves the runtime-equivalent role does not bypass RLS
- backend tests stay green with the application role contract
- frontend build still completes

### Smoke-test checklist

- `GET /health` returns OK
- anonymous storefront route resolves:
  - `GET /restaurants/:slug/storefront`
- owner dashboard route still works
- order creation still works
- payment callback tests still pass

## Staging

### Preflight checks

1. Use the staging app DB role and staging database URL:

```bash
$env:APP_RUNTIME_DATABASE_URL = "<staging-app-runtime-postgres-url>"
$env:RLS_APPLY_DATABASE_URL = "<staging-apply-postgres-url>"
```

The validation commands must resolve to `APP_RUNTIME_DATABASE_URL`, not plain `DATABASE_URL`.

2. Confirm a recent backup/snapshot exists.
3. Confirm tenant A / tenant B probe restaurants exist in staging or create dedicated validation tenants.
4. Confirm backend/app deploys are on the commit that contains:
   - backend tenant-context integration
   - public storefront contract
   - current Prisma schema

### Apply

```bash
npm run rls:audit:validate
npm run rls:audit:apply
npm run rls:preflight
npm run rls:apply
```

### Post-apply validation

```bash
npm run rls:validate
npm run rls:validate:backend
npm --prefix backend run test
npm run build
```

Required PASS signals:
- `rls:preflight` confirms a non-privileged app-equivalent role
- `rls:audit:validate` proves `rolbypassrls=false`
- `rls:audit:validate` proves `usesRequiredRuntimeEnv=true`
- `rls:validate` completes without SQL exceptions
- `rls:validate:backend` confirms the app-equivalent backend session contract
- no `permission denied` or `Missing app.restaurant_id context` regressions appear in logs

### Immediate monitoring

- backend `401` / `403` spikes
- `permission denied for table` in API logs
- storefront 404/500 rates
- checkout/order creation failures
- payment callback failures
- upload finalization failures

## Production

### Preflight checks

1. Schedule a low-traffic deploy window.
2. Confirm:
   - fresh backup/snapshot
   - rollback owner
   - exact DB role that the app uses for runtime validation
   - exact DB role that will be used for apply, if different
   - `APP_RUNTIME_DATABASE_URL` is populated in the active backend environment
3. Dry-run the exact migration in staging first on the same code revision.
4. Verify probe tenant IDs exist in production validation space, or prepare dedicated validation restaurants.
5. Ensure backend version with transaction-local `app.restaurant_id`, `app.user_id`, and `app.is_admin` is already deployed or released alongside the migration.

### Apply

Run from a controlled operator shell:

```bash
npm run rls:audit:validate
npm run rls:audit:apply
npm run rls:preflight
npm run rls:apply
```

### Post-apply validation

Run immediately:

```bash
npm run rls:validate
npm run rls:validate:backend
```

Then run app compatibility checks:

```bash
npm --prefix backend run test
npm run build
```

Required PASS signals:
- `rls:preflight` was run against the same DB role the app uses
- `rls:audit:validate` proved the runtime-equivalent role does not bypass RLS
- `rls:audit:validate` proved `usesRequiredRuntimeEnv=true`
- `rls:validate` completes without SQL exceptions
- `rls:validate:backend` confirms the backend runtime contract with the same DB role
- storefront, dashboard, payments, and uploads show no immediate regressions

### Immediate monitoring signals

- backend error logs for:
  - `permission denied`
  - `Missing app.restaurant_id context`
  - `Missing app.user_id context`
- storefront menu request errors
- dashboard load failures
- order creation drop
- payment creation/callback error rate
- upload route failures

## Rollback Considerations

This rollout changes both structure and security behavior. Rollback is not a single-step `down` migration.

Use this order:

1. If the app is unhealthy, stop further deploys.
2. Restore from the pre-rollout database backup if data correctness is in doubt.
3. If a fast mitigation is required before restore, use a reviewed emergency SQL change in a controlled window to relax or disable the specific blocking policy/table only.
4. Keep the backend version aligned with the database state. Do not leave the app expecting RLS while the DB is partially rolled back.

Do not improvise broad `DISABLE ROW LEVEL SECURITY` statements in production without approval and scope control.

### Rollback triggers

Rollback planning should start immediately if any of these occur after apply:

- `permission denied` errors spike on intended same-tenant flows
- `Missing app.restaurant_id context` or `Missing app.user_id context` appears in backend logs
- storefront menu reads fail for healthy restaurants
- order creation or payment initiation fails at materially elevated rates
- uploads or inventory-backed staff flows fail due to RLS denials
- SQL validation or backend contract validation fails and the issue cannot be corrected quickly without broad policy changes

## Defined Critical Flow Test Paths

- Same-role preflight:
  - `npm run rls:preflight`
- SQL validation:
  - `npm run rls:validate`
- Backend session contract:
  - `npm run rls:validate:backend`
- Public storefront contract:
  - `npm --prefix backend run test -- public-storefront.service.test.ts`
- Backend tenant context:
  - `npm --prefix backend run test -- db-rls-context.test.ts`
- Payment callback safety:
  - `npm --prefix backend run test -- payment.service.test.ts`
- Frontend storefront compilation:
  - `npm run build`
