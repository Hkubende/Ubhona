# Ubhona v4 - Visualize

## Project status

Live project progress is tracked here:

- [PROJECT_STATUS.md](./PROJECT_STATUS.md)

## M-Pesa backend quick check

Run a direct health check against the STK backend:

```bash
npm run check:mpesa
```

Use a custom backend URL:

```bash
STK_API_BASE="https://your-backend.example.com" npm run check:mpesa
```

Frontend runtime override:

```bash
VITE_STK_API_BASE="https://your-backend.example.com"
```

If the backend is unavailable, AR checkout falls back to manual M-Pesa flow.

Trigger an MV4 STK push from terminal:

```bash
STK_PHONE=0745123456 STK_AMOUNT=1 npm run stk:mv4
```

Optional vars:
- `STK_API_BASE` (default `https://menuvista-mpesa-backend.onrender.com`)
- `STK_REF` (default `MV4-ORDER`)
- `STK_DESC` (default `Ubhona MV4`)

## Backend service in this repo

Start the backend locally:

```bash
npm run backend:start
```

For dev auto-reload:

```bash
npm run backend:dev
```

Backend endpoints:
- `GET /health`
- `POST /stkpush`
- `POST /callback`
- `GET /callbacks/latest` (debug)

Config:
- Copy `backend/.env.example` to your environment on Render/host and set values.
- Point frontend to backend with `VITE_STK_API_BASE` (for example `http://localhost:8787`).

## Ubhona (Visualize)

Ubhona is the rebranded v4 codebase. The current focus is a stable AR-first menu and ordering flow while platform features continue to grow.

Core routes:
- `/`
- `/dashboard`
- `/ar`
- `/checkout`
- `/orders`

Storefront routes:
- `/r/:slug`
- `/r/:slug/menu`
- `/r/:slug/ar`
- `/r/:slug/checkout`
- `/r/:slug/order/:orderId`

## Development

Start frontend:

```bash
npm run dev
```

## Development Workflow

1. Start the frontend:

```bash
npm run dev
```

2. Open Codex (Git Bash recommended):

```bash
codex
```

3. Ask Codex to inspect the running app via DevTools MCP.

Example prompts:
- "Inspect the dashboard page and list React components rendered."
- "Check network requests when opening the AR menu."
- "Identify performance bottlenecks in the AR viewer."

Build:

```bash
npm run build
```

Validate menu data/assets:

```bash
npm run validate:data
```

## Project Validation

Run the full project validation before deployment:

```bash
npm run check:all
```

This command checks:

- menu data structure
- asset paths (3D models + thumbnails)
- dish definitions
- production build

## CI

Workflow: `.github/workflows/ci.yml`

It runs on:
- push to `main`
- pull requests targeting `main`

Checks performed:
- `npm install`
- `npm run check:all`

## Deployment

Environment files:
- `.env`: local defaults for development.
- `.env.production`: production defaults for local/CI production builds.
- `.env.example`: non-secret template for new environments.

API configuration:
- Local backend example: `VITE_API_BASE=http://localhost:4000`
- Production backend example: `VITE_API_BASE=https://api.your-domain.com`
- If `VITE_API_BASE` is empty, API calls are disabled and the app uses static/demo fallback paths where available.
- GitHub Pages static/demo deploy should keep `VITE_API_BASE` unset unless a real backend exists.

Workflows:
- CI validation: `.github/workflows/ci.yml` (checks and build validation only).
- Deployment-mode preview check: `.github/workflows/deploy-preview-check.yml` (Render-like build verification, no production deploy).
- GitHub Pages deploy: `.github/workflows/deploy-pages.yml` (publishes `dist` on push to `main`).
- Render production deploy is handled by Render.

Render (static site):
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_BASE_PATH=/`

GitHub Pages (`https://hkubende.github.io/Ubhona/`):
- Build uses `VITE_BASE_PATH=/Ubhona/`.
- Keep `VITE_API_BASE` empty for static/demo mode unless a real backend is available.

More deployment details: `docs/deployment.md`.
