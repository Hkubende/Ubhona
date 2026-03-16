# Deployment Guide

## Render (Static Site)

Use these Render settings:

- Service type: `Static Site`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment variable: `VITE_BASE_PATH=/`

The repository `render.yaml` is aligned with the above.

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
