# Incident response runbook

## Triage

1. Record detection time, affected workspace and project ids, observed status codes and the reporter. Do not copy secrets, tokens or plaintext values into tickets.
2. Check the public probe with `curl -fsS "$API_BASE_URL/health"`. A failure there points to process or infrastructure, not tenant data.
3. Read structured logs. `request completed` events carry method, path, status and `durationMs`; `LOG_LEVEL` controls verbosity. Pino redacts authorization, cookie, body, query, value, password, token, ciphertext and authTag fields.
4. Query audit history with an authenticated `GET /workspaces/:workspaceId/audit?projectId=<id>&limit=100` (requires `audit.read`). Rows carry actor type and id, action, metadata, hashed IP, user agent and timestamp. Scheduled job failures are emailed to `OPS_ALERT_EMAIL`.
5. Reproduce locally with `pnpm typecheck && pnpm lint && pnpm test` before changing code.

## Containment

- Compromised service token: revoke with `POST /workspaces/:workspaceId/projects/:projectId/credentials/:tokenId/revoke` or rotate with `POST /workspaces/:workspaceId/projects/:projectId/credentials/:tokenId/rotate` (requires `credentials.manage`). Production uses the Redis revocation cache, so revocation takes effect immediately. Keep the plaintext token out of shell history and tickets.
- Suspected user session compromise: trigger `POST /auth/password-reset/request` and review audit rows for that actor. There is no admin endpoint to revoke another user's sessions.
- Key exposure or decryption failures: follow `key-rotation.md` and keep old providers registered for dual-read.
- Cross-tenant access or audit gaps: stop writes to the affected workspace, preserve audit rows, and run the cross-tenant denial suite (`pnpm test`) before resuming.
- Webhook abuse: deactivate with `DELETE /workspaces/:workspaceId/projects/:projectId/webhooks/:webhookId` and inspect `GET /workspaces/:workspaceId/projects/:projectId/webhooks/:webhookId/deliveries` (requires `webhooks.manage`).

## Evidence and reporting

Collect request path, status, duration, actor id, action and timestamps only. IPs are stored as hashes and secret values are redacted in logs and audit metadata. Record the deployed commit and config version in the incident timeline.

## Recovery

Redeploy the last known-good commit per `deploy.md`. For lost or corrupted data, restore from Atlas PITR into a staging database first, verify tenant scoping and audit rows, then promote. Do not repair secret values by direct database writes outside an audited, reviewed procedure.

## Follow-up

Add a regression test for the root cause, update the relevant runbook, and append verification results to `docs/PHASE-LOG.md` when the fix lands.
