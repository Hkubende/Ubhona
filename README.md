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

Build:

```bash
npm run build
```

Validate menu data/assets:

```bash
npm run validate:data
```
