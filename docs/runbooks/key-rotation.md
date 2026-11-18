# Key rotation runbook

## Scope

Rotates the encryption keys used by `secretvalues`. Rotation re-encrypts values in place under the same GCM AAD and does not create `secrethistory` rows. Never print keys, wrapped data keys or plaintext values.

## Current key wiring

- `AEGIS_KMS_KEY_ID` registers one KMS provider (`apps/api/src/crypto/kms-key.provider.ts`); `AWS_REGION` and AWS credentials are required.
- `AEGIS_MASTER_KEY` registers the env provider with fixed key id `env-master-v1`, also used for legacy cipher v1 reads.
- `apps/api/src/container.ts` registers at most one KMS key and one env key. The rotation target must already be in that registry. Do not repoint `AEGIS_KMS_KEY_ID` at a new key while values still reference the old id: dual-read by `keyId` would fail. Rotating between two KMS keys requires config support first.
- Set `WEBHOOK_SECRET_ENCRYPTION_KEY` explicitly before changing `AEGIS_MASTER_KEY`; the webhook secret cipher falls back to the master key and has no rotation path.

## Preflight

1. Inventory values by key id and cipher version:

```bash
mongosh "$MONGODB_URI" --quiet --eval 'db.secretvalues.aggregate([{ $group: { _id: { keyId: "$keyId", cipherVersion: "$cipherVersion" }, count: { $sum: 1 } } }])'
```

2. Confirm the target key id resolves in the deployed process and that old providers remain registered for dual-read.
3. Deploy config with the target key registered, keeping old key material available.

## Rotate one project

With a JWT session holding `secrets.update` and project admin access, call `POST /workspaces/:workspaceId/projects/:projectId/secrets/keys/rotate` with body `{"targetKeyId":"<registered-key-id>"}`. The request is audited as `secrets.rotateKeys`; unknown key ids and non-admin callers are rejected.

## Rotate all due values

Set `JOB_KEY_ROTATION_TARGET_ID` to a registered key id and redeploy. The `key-rotation` job runs every `JOB_KEY_ROTATION_INTERVAL_MS` (default 86,400,000 ms) and re-encrypts values whose `keyId` differs from the target or whose `cipherVersion` is not 2. It is a no-op without a target, uses a Redis lock in production, and sends failures to `OPS_ALERT_EMAIL`. The job writes no audit row; record the run in the change ticket.

## Verify and clean up

1. Re-run the inventory query; all values should show the target key id and `cipherVersion: 2`.
2. Check one secret with an authenticated reveal request and compare the value out of band; do not log, paste or ticket the value.
3. Keep old providers registered until the inventory is clean. Only then remove old key material from config, with backups retained under the retention policy.

## Abort

Redeploy without `JOB_KEY_ROTATION_TARGET_ID` to stop the scheduled job, or send `SIGTERM` to the API to stop all jobs. Values already rotated remain readable while their key provider is registered. There is no automatic rollback: fix the cause and re-run rotation to the same target. Never delete a key still referenced by `secretvalues`.
