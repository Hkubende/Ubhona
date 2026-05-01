# Deployment Guide

## Render Production Topology

Ubhona production runs as two Render services from the same GitHub repository:

| Service | Render type | Root directory | Build command | Start / publish |
|---|---|---|---|---|
| `Ubhona-api` | Node web service | `backend` | `npm ci --include=dev && npm run prisma:generate && npm run build` | `npm run start` |
| `Ubhona` | Static site | repository root | `npm install && npm run build` | `dist` |

The repository `render.yaml` is the source-of-truth blueprint for this two-service shape. It intentionally marks secrets with `sync: false`; fill those values in the Render Dashboard or environment group.

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

- `DATABASE_URL`
- `JWT_SECRET`
- `ORDER_TRACKING_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- payment provider secrets when payment flows are enabled
- WhatsApp provider secrets when WhatsApp is enabled

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
