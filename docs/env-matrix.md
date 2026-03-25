# Ubhona Environment Variable Matrix

Last updated: 2026-03-21

This matrix defines strict env values for local, staging/preview, and production.

## Rules

- Frontend may only use `VITE_*` variables.
- Backend secrets must never be exposed to frontend.
- Do not commit real secrets to git.
- Set secrets only in hosting dashboards (Vercel + backend host).

## 1) Frontend (Vite / Vercel)

| Variable | Local | Staging / Preview | Production | Required |
|---|---|---|---|---|
| `VITE_BASE_PATH` | `/` | `/` | `/` | Yes |
| `VITE_API_BASE` | `http://localhost:4000` | `https://api-staging.ubhona.com` | `https://api.ubhona.com` | Yes (for real backend mode) |
| `VITE_STK_API_BASE` | `http://localhost:4000` | `https://api-staging.ubhona.com` | `https://api.ubhona.com` | Optional |
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` | `https://<staging-project>.supabase.co` | `https://<prod-project>.supabase.co` | Yes (uploads) |
| `VITE_SUPABASE_ANON_KEY` | `<anon-key>` | `<anon-key>` | `<anon-key>` | Yes (uploads) |
| `VITE_LOG_API_INFO` | `true` or `false` | `false` | `false` | Optional |
| `VITE_PUBLIC_APP_URL` | `http://localhost:5173` | `https://app-staging.ubhona.com` | `https://app.ubhona.com` | Recommended |
| `VITE_APP_NAME` | `Ubhona` | `Ubhona` | `Ubhona` | Optional |
| `VITE_APP_SLOGAN` | `Visualize` | `Visualize` | `Visualize` | Optional |

Notes:
- `VITE_PUBLIC_APP_URL` is used for QR/share URL generation fallback safety.
- If `VITE_API_BASE` is empty, frontend runs in demo/static mode by design.

## 2) Backend

| Variable | Local | Staging | Production | Required |
|---|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` | Yes |
| `PORT` | `4000` or `8787` | host-assigned or `4000` | host-assigned or `4000` | Yes |
| `APP_BASE_URL` | `http://localhost:4000` | `https://api-staging.ubhona.com` | `https://api.ubhona.com` | Recommended |
| `FRONTEND_URL` | `http://localhost:5173` | `https://app-staging.ubhona.com` | `https://app.ubhona.com` | Recommended |
| `APP_PUBLIC_BASE_URL` | `http://localhost:5173` | `https://app-staging.ubhona.com` | `https://app.ubhona.com` | Yes (order links) |
| `QR_BASE_URL` | `http://localhost:5173` | `https://app-staging.ubhona.com` | `https://app.ubhona.com` | Optional |
| `PUBLIC_APP_URL` | `http://localhost:5173` | `https://app-staging.ubhona.com` | `https://app.ubhona.com` | Optional |
| `DATABASE_URL` | `<local-postgres-url>` | `<staging-postgres-url>` | `<prod-postgres-url>` | Yes |
| `JWT_SECRET` | `<dev-secret>` | `<strong-secret>` | `<strong-secret>` | Yes |
| `ORDER_TRACKING_SECRET` | `<dev-strong-secret>` | `<strong-secret>` | `<strong-secret>` | Yes (public tracking links) |
| `SUPABASE_URL` | `https://<project>.supabase.co` | `https://<staging-project>.supabase.co` | `https://<prod-project>.supabase.co` | Yes |
| `SUPABASE_ANON_KEY` | `<anon-key>` | `<anon-key>` | `<anon-key>` | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | `<service-role-key>` | `<service-role-key>` | Yes |
| `SUPABASE_STORAGE_BUCKET_THUMBNAILS` | `dish-thumbnails` | `dish-thumbnails` | `dish-thumbnails` | Yes |
| `SUPABASE_STORAGE_BUCKET_MODELS` | `dish-models` | `dish-models` | `dish-models` | Yes |
| `SUPABASE_STORAGE_BUCKET_BRANDING` | `restaurant-branding` | `restaurant-branding` | `restaurant-branding` | Optional |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://app-staging.ubhona.com` | `https://app.ubhona.com` | Yes |

## 3) M-Pesa (Kenya-first)

| Variable | Sandbox / Staging | Production | Required |
|---|---|---|---|
| `MPESA_ENV` | `sandbox` | `production` | Yes |
| `MPESA_CONSUMER_KEY` | `<sandbox-consumer-key>` | `<prod-consumer-key>` | Yes |
| `MPESA_CONSUMER_SECRET` | `<sandbox-consumer-secret>` | `<prod-consumer-secret>` | Yes |
| `MPESA_SHORTCODE` | `<sandbox-shortcode>` | `<prod-shortcode>` | Yes |
| `MPESA_PASSKEY` | `<sandbox-passkey>` | `<prod-passkey>` | Yes |
| `MPESA_CALLBACK_URL` | `https://api-staging.ubhona.com/payments/callback` | `https://api.ubhona.com/payments/callback` | Yes |
| `MPESA_CALLBACK_SECRET` | `<staging-callback-secret>` | `<prod-callback-secret>` | Yes |
| `MPESA_TIMEOUT_URL` | `https://api-staging.ubhona.com/payments/timeout` | `https://api.ubhona.com/payments/timeout` | Optional/Recommended |
| `MPESA_TRANSACTION_TYPE` | `CustomerPayBillOnline` | `CustomerPayBillOnline` | Recommended |
| `MPESA_PARTY_B` | `<shortcode-or-till>` | `<shortcode-or-till>` | Optional |
| `BILLING_MPESA_MODE` | `mock` or `live` | `live` | Yes |

## 4) WhatsApp Providers

### Meta WhatsApp Cloud API

| Variable | Staging | Production | Required |
|---|---|---|---|
| `WHATSAPP_PROVIDER` | `meta_cloud` | `meta_cloud` | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | `<phone-number-id>` | `<phone-number-id>` | Yes |
| `WHATSAPP_ACCESS_TOKEN` | `<access-token>` | `<access-token>` | Yes |
| `WHATSAPP_VERIFY_TOKEN` | `<verify-token>` | `<verify-token>` | Recommended |
| `WHATSAPP_WEBHOOK_SECRET` | `<webhook-secret>` | `<webhook-secret>` | Recommended |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `<waba-id>` | `<waba-id>` | Optional |

Backward-compatible aliases (if already used): `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_PHONE_NUMBER_ID`.

### Twilio WhatsApp

| Variable | Staging | Production | Required |
|---|---|---|---|
| `WHATSAPP_PROVIDER` | `twilio` | `twilio` | Yes |
| `TWILIO_ACCOUNT_SID` | `<sid>` | `<sid>` | Yes |
| `TWILIO_AUTH_TOKEN` | `<token>` | `<token>` | Yes |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` or approved sender | approved sender | Yes |

## 5) Dashboard Setup (where to set vars)

### Vercel (Frontend project)
- Set only `VITE_*` vars.
- Use Environment scopes:
  - Development: local-connected preview if needed
  - Preview: staging values
  - Production: production values

### Backend host (Render/Railway/Fly/etc)
- Set all non-`VITE_*` backend vars.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, payment tokens, and WhatsApp tokens secret.
- Ensure callback URLs are reachable over HTTPS.

## 6) Validation Checklist (before go-live)

1. Frontend build passes with production vars.
2. Backend build starts with production vars.
3. `GET /health` returns OK in staging and production backend.
4. Frontend can call backend (`VITE_API_BASE`) without CORS errors.
5. Storefront routes refresh correctly (`vercel.json` rewrite).
6. QR links resolve to `VITE_PUBLIC_APP_URL` domain.
7. Uploads work for thumbnails and `.glb/.gltf`.
8. M-Pesa callback endpoint receives provider callbacks.
9. WhatsApp provider credentials validated with a test message.
