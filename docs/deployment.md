# Deployment Guide

## Render Production Topology

Ubhona production currently runs as two Render services from the same GitHub repository:

| Service | Render type | Root directory | Build command | Start / publish |
|---|---|---|---|---|
| `Ubhona-api` | Node web service | `backend` | `npm ci --include=dev && npm run prisma:generate && npm run build` | `npm run start` |
| `Ubhona` | Static site | repository root | `npm install && npm run build` | `dist` |

The repository [render.yaml](/C:/Users/STEM/Ubhona/render.yaml) is the source-of-truth blueprint for this two-service shape. It intentionally marks secrets with `sync: false`; fill those values in the Render Dashboard or environment group.

## Render Backend (`Ubhona-api`)

Required non-secret settings:

- Service type: `Web Service`
- Runtime: `Node`
- Root Directory: `backend`
- Health Check Path: `/health`
- Auto Deploy: `yes`
- `NODE_ENV=production`
- `CORS_ORIGIN=https://ubhona.onrender.com`
- `APP_BASE_URL=https://ubhona-api.onrender.com`
- `FRONTEND_URL=https://ubhona.onrender.com`
- `APP_PUBLIC_BASE_URL=https://ubhona.onrender.com`
- `QR_BASE_URL=https://ubhona.onrender.com`
- `PUBLIC_APP_URL=https://ubhona.onrender.com`

Required secret or environment-specific values:

- `APP_RUNTIME_DATABASE_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `PAYMENT_PROFILE_ENCRYPTION_KEY`
- `ORDER_TRACKING_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- payment provider secrets when payment flows are enabled
- WhatsApp provider secrets when WhatsApp is enabled

Health/runtime identity:

- `GET /health` should stay fast and return safe runtime/build identity fields.
- `GET /health/db` is the DB readiness probe and should return `200` only when the DB probe succeeds.

Backend validation:

```bash
curl https://ubhona-api.onrender.com/health
curl https://ubhona-api.onrender.com/health/db
```

## Render Frontend (`Ubhona`)

Use these Render settings:

- Service type: `Static Site`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- SPA rewrite: `/* -> /index.html`

Required frontend variables:

- `VITE_BASE_PATH=/`
- `VITE_API_BASE=https://ubhona-api.onrender.com`
- `VITE_STK_API_BASE=https://ubhona-api.onrender.com`
- `VITE_PUBLIC_APP_URL=https://ubhona.onrender.com`
- `VITE_SITE_URL=https://ubhona.onrender.com`
- `VITE_UPLOAD_PROVIDER=api`
- `VITE_LOG_API_INFO=false`
- `VITE_APP_NAME=Ubhona`
- `VITE_APP_SLOGAN=Visualize`
- `VITE_ENABLE_ANALYTICS=false`
- `VITE_ENABLE_ORDERS=false`

Frontend validation:

```bash
curl https://ubhona.onrender.com
curl https://ubhona.onrender.com/dashboard
```

## GitHub Pages

The app can still be deployed to GitHub Pages as a static frontend preview.

- Base path: `/Ubhona/`
- GitHub Pages workflow: `.github/workflows/deploy-pages.yml`
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
