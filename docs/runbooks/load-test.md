# Load test runbook

## Target

`GET /health/live` with 50 concurrent connections for 30 seconds. Pass requires at least 200 requests/sec and p95 latency <= 250 ms. `apps/api/src/health/health.controller.ts` exposes the public liveness route; record the exact path tested.

## Preconditions

- Deploy the release under test per `deploy.md` with `NODE_ENV=production`; do not test a `tsx watch` process.
- Run from a separate host with network parity to production. Set `API_BASE_URL` to the API origin. The probe is public, so no token or cookie is needed.
- The vendored `pnpm load:test` command builds the API and runs `scripts/load-test.mjs` against a local stub-backed server; use `npx --yes autocannon` for an external target.

## Procedure

```bash
pnpm load:test

export API_BASE_URL="https://<api-host>"
npx --yes autocannon -c 50 -d 30 "$API_BASE_URL/health/live"
```

Add `--json` to save machine-readable output.

## Record and decide

Record commit, environment, timestamp, connections, duration, requests/sec, p95 and non-2xx count. Run three times and use the median. Meet both thresholds to pass.

If it fails, check ingress connection limits, event-loop blocking in API logs and noisy neighbours; rerun after each change. Do not weaken authentication, redaction, rate limits or validation to improve numbers. File the failing metrics with the test result.
