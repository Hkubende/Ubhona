# Deployment Guide

## Render (Frontend + API)

Ubhona production is a two-service Render setup:

- Frontend: `Static Site`
- Backend: `Web Service` (`Node` runtime, rooted at `backend/`)

The repository [render.yaml](/C:/Users/STEM/Ubhona/render.yaml) now encodes both services.

Frontend service (`ubhona-app`):

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Rewrite: `/* -> /index.html`
- Required non-secret runtime values:
  - `VITE_BASE_PATH=/`
  - `VITE_API_BASE=https://api.ubhona.com`
  - `VITE_STK_API_BASE=https://api.ubhona.com`
  - `VITE_PUBLIC_APP_URL=https://app.ubhona.com`
  - `VITE_SITE_URL=https://app.ubhona.com`
  - `VITE_UPLOAD_PROVIDER=api`

Backend service (`ubhona-api`):

- Root directory: `backend`
- Runtime: `node`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Health check path: `/health`
- Public base URL expectation: `https://api.ubhona.com`
- Frontend origin expectation: `https://app.ubhona.com`

Health/runtime identity:

- `GET /health` should stay fast and return safe runtime/build identity fields, including package version and any available Render commit metadata.
- `GET /health/db` is the DB readiness probe and should return:
  - `200` only when the database probe succeeds
  - `500` with structured JSON diagnostics when DB reachability or DB runtime identity is red
- When validating deploy-source correctness on Render, prefer checking:
  - `build.packageName`
  - `build.packageVersion`
  - `build.commitSha`
  - `build.deployServiceName`
  - `build.healthShapeVersion`

Backend secret/runtime vars must be set in the Render dashboard on initial Blueprint creation with `sync: false` prompts, including:

- `APP_RUNTIME_DATABASE_URL`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` if not using generated value
- M-Pesa credentials/callback values
- WhatsApp provider credentials

## GitHub Pages

GitHub Pages deployment uses a repository base path:

- Environment variable: `VITE_BASE_PATH=/Ubhona/`
- Workflow: `.github/workflows/deploy-pages.yml`

## Deployment Preview Check (GitHub Actions)

Use `.github/workflows/deploy-preview-check.yml` to verify deployment-mode build behavior without deploying production:

- Trigger: `workflow_dispatch` and PRs to `main`
- Runs: `npm install`
- Runs: `VITE_BASE_PATH=/ npm run build`
- Uploads: `dist` artifact for inspection

## CI vs Deployment Workflows

- CI validation: `.github/workflows/ci.yml` (project checks/validation)
- Deploy preview check: `.github/workflows/deploy-preview-check.yml` (Render-like build verification)
- Production deploy target for Render is handled by Render itself, not this preview-check workflow.
- GitHub Pages remains static/demo-capable only unless a real backend is intentionally wired in.

## PostgreSQL RLS Rollout

Use `docs/rls-rollout.md` for the database rollout package:

- preflight
- apply
- validation
- environment-specific rollout steps for local/dev, staging, and production

Runner commands:

```bash
npm run rls:preflight
npm run rls:apply
npm run rls:validate
npm run rls:validate:backend
npm run rls:validate:full
```

Environment contract for RLS rollout:

- `APP_RUNTIME_DATABASE_URL`: non-privileged runtime-equivalent role
- `APP_RUNTIME_DATABASE_URL` is required for `rls:audit:validate`, `rls:preflight`, `rls:validate`, and `rls:validate:backend`
- `rls:audit:validate` and all runtime-equivalent validation commands must report `usesRequiredRuntimeEnv=true`
- `RLS_APPLY_DATABASE_URL`: optional stronger apply/migration role
- `DATABASE_URL`: apply/migration path only
- `DATABASE_URL` is not accepted as the sole source for runtime-equivalent RLS validation
