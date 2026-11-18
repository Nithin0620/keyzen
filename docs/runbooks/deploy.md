# Deploy runbook

## Scope

Deploys the Express API and Next.js dashboard from this monorepo. Node >= 20 and pnpm 11.27.0 are required (see root `package.json`). There is no container image or deploy workflow in this repository; `.github/workflows/ci.yml` verifies code only.

## Prerequisites

- CI green on the commit being deployed: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e:list`, `pnpm build`, `pnpm test:sdk:pack`, `pnpm load:test`.
- MongoDB 8 replica set and Redis 7 reachable from the API. Local dev uses `docker compose up -d` then `pnpm db:init`; a managed Atlas replica set does not need `db:init`.
- Secrets injected by the platform secret store, never from a committed `.env`. `apps/api/src/config/env.ts` fails fast in production when required values are missing.

## Required production configuration

- `NODE_ENV=production`, `MONGODB_URI`, `REDIS_URL` (override the localhost default), `API_PORT`, `WEB_ORIGIN` (exact HTTPS dashboard origin) and optional comma-separated `WEB_ORIGINS` for extra CORS origins.
- `ENFORCE_TLS=true`, `TRUST_PROXY=1` or higher, and `SENTRY_DSN`; production startup fails fast without them.
- `AUTH_SECRET` of at least 32 characters.
- `AEGIS_KMS_KEY_ID`, `AWS_REGION` and AWS credentials. `AEGIS_MASTER_KEY` is the dev fallback and is not the production default.
- `RESEND_API_KEY`, `EMAIL_FROM`, `OPS_ALERT_EMAIL`, `WEBHOOK_SECRET_ENCRYPTION_KEY`.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`.
- Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`; `AUDIT_RETENTION_DAYS`, `SERVICE_TOKEN_RATE_LIMIT`, `SERVICE_TOKEN_RATE_WINDOW_MS`, `LOG_LEVEL`, job intervals.
- Optional tracing: `OTEL_ENABLED=true` with `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME`; hardening knobs include `REQUEST_BODY_LIMIT`, `MAX_URL_LENGTH`, `GLOBAL_RATE_LIMIT`, `GLOBAL_RATE_WINDOW_MS`, `ABUSE_ALERT_THRESHOLD` and `ABUSE_ALERT_WINDOW_MS`.

## Procedure

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:sdk:pack
pnpm db:indexes
pnpm --filter @aegis/api start
pnpm --filter @aegis/web start
```

Start the API and web processes separately. `pnpm db:indexes` runs `dist/database/indexes.js` against `MONGODB_URI` and syncs indexes; rerun it after changing `AUDIT_RETENTION_DAYS`. Terminate TLS at the ingress proxy and forward `X-Forwarded-Proto` (plus `X-Forwarded-For` for client IPs); otherwise `ENFORCE_TLS` rejects valid traffic because Express does not terminate TLS.

Verify with `curl -fsS "$API_BASE_URL/health/live"`, which returns `{"status":"ok","service":"aegis-api"}`. Use `GET /health/ready` for dependency readiness; it returns 503 when MongoDB or Redis is unavailable. Confirm the dashboard loads from `WEB_ORIGIN` and that an authenticated session can read a workspace.

## Rollback and shutdown

Redeploy the previous known-good commit and its config. Keep `AEGIS_KMS_KEY_ID` and any previous key ids available while secret values still reference them (see `key-rotation.md`). Index changes are not reverted automatically; review them before rolling back.

`SIGTERM` stops scheduled jobs, closes the HTTP server, then closes MongoDB and Redis (`apps/api/src/main.ts`). Drain traffic before sending `SIGTERM`.
