# Keyzen SaaS Features Implementation Plan

## Goal
Transform Keyzen from a core secrets manager into a full-featured SaaS platform by implementing:
1. **Bulk `.env` Import / Export**
2. **Audit Trail UI & Activity Feed**
3. **Secret Versioning & 1-Click Rollback**
4. **Team Workspaces & Role-Based Access Control (RBAC)**
5. **Webhooks & Slack / Discord Alerts**
6. **Stripe Billing & Plan Limits**

All features maintain the **clean, minimal Next.js + TypeScript + PostgreSQL** architecture with zero bloat.

---

## Architecture & Schema Additions

### New Database Tables in `lib/schema.ts`
1. **`secret_history`**:
   - `id: uuid`
   - `secretId: uuid (references secrets.id)`
   - `environmentId: uuid (references environments.id)`
   - `version: integer`
   - `ciphertext: text`
   - `iv: text`
   - `authTag: text`
   - `changedBy: text`
   - `createdAt: timestamp`

2. **`webhooks`**:
   - `id: uuid`
   - `projectId: uuid (references projects.id)`
   - `url: text`
   - `events: text[]` (e.g. `['SECRET_UPDATE', 'TOKEN_REVOKE']`)
   - `platform: text` ('SLACK' | 'DISCORD' | 'GENERIC')
   - `isActive: boolean`
   - `createdAt: timestamp`

3. **`subscriptions`**:
   - `id: uuid`
   - `orgId: uuid (references organizations.id)`
   - `stripeCustomerId: text`
   - `stripeSubscriptionId: text`
   - `plan: text` ('FREE' | 'PRO' | 'ENTERPRISE')
   - `status: text`
   - `currentPeriodEnd: timestamp`

---

## Detailed Task Breakdown

### Phase 1: Bulk `.env` Import & Export
- **File updates**:
  - `app/api/secrets/batch/route.ts`: Endpoint to parse and batch upsert encrypted secrets in a single SQL transaction.
  - `app/dashboard/[projectId]/page.tsx`:
    - "Import .env" modal with file drag-and-drop or raw text paste.
    - "Export .env" button to export decrypted secrets as formatted `.env` or JSON.
- **Verification**: Import a 10-line `.env` file, verify in database and UI, then export it and verify content matches.

### Phase 2: Audit Trail UI & Activity Feed
- **File updates**:
  - `app/api/audit/route.ts`: Filterable endpoint querying `audit_logs` by `projectId`, `action`, and date range.
  - `app/dashboard/audit/page.tsx` or Project Audit Tab:
    - Live activity feed showing actor (`USER` / `SERVICE_TOKEN`), action, environment, client IP, and formatted timestamp.
    - Search & filter by action (`SECRET_CREATE`, `SECRET_RESOLVE_BATCH`, `TOKEN_CREATE`, etc.).
- **Verification**: Resolve secrets via CLI, check that audit log record appears instantaneously in the UI.

### Phase 3: Secret Versioning & 1-Click Rollback
- **File updates**:
  - `lib/schema.ts`: Add `secret_history` table and migration.
  - `app/api/secrets/route.ts`: On secret update, automatically archive current ciphertext into `secret_history`.
  - `app/api/secrets/history/route.ts`: List past versions for a given secret.
  - `app/api/secrets/rollback/route.ts`: Restore a past version into `secret_values`.
  - `app/dashboard/[projectId]/page.tsx`:
    - "History" icon on each secret row opening a version timeline modal with "Rollback to this version" action.
- **Verification**: Update a secret from `VALUE_V1` to `VALUE_V2`, view history, click rollback, verify `VALUE_V1` is restored.

### Phase 4: Team Workspaces & Role-Based Access Control (RBAC)
- **File updates**:
  - `app/api/team/route.ts`: List team members from `org_members`.
  - `app/api/team/invite/route.ts`: Invite new members with assigned role (`ADMIN`, `MEMBER`, `VIEWER`).
  - `app/api/team/[memberId]/route.ts`: Update role or remove member.
  - `app/dashboard/team/page.tsx`: Workspace team management UI.
  - Guard logic: `VIEWER` role cannot view production secrets or create service tokens.
- **Verification**: Add member with `VIEWER` role and verify permission restrictions.

### Phase 5: Webhooks & Slack / Discord Alerts
- **File updates**:
  - `lib/webhooks.ts`: Async dispatcher sending Slack / Discord block-kit or generic JSON payloads on secret changes.
  - `app/api/webhooks/route.ts`: CRUD for webhook subscriptions.
  - `app/dashboard/[projectId]/integrations/page.tsx`: UI to add webhook URLs (Slack, Discord, generic) and send test events.
- **Verification**: Trigger a secret update and verify webhook notification payload.

### Phase 6: Stripe Billing & Plan Limits
- **File updates**:
  - `lib/billing.ts`: Plan definitions (Free: 3 projects, 25 secrets; Pro: Unlimited, $15/mo).
  - `app/api/billing/checkout/route.ts`: Generates Stripe Checkout Session.
  - `app/api/billing/webhook/route.ts`: Stripe webhook to update organization subscription status.
  - `app/dashboard/billing/page.tsx`: Pricing and subscription management page.
  - Guard logic in `POST /api/projects`: Prevent creating > 3 projects on the Free tier.
- **Verification**: Test checkout endpoint redirect and plan limits enforcement.

---

## Execution Order
We will implement these in logical dependency order:
1. **Phase 1: Bulk `.env` Import / Export** (Immediate developer UX improvement)
2. **Phase 2: Audit Trail UI** (Exposing already existing DB logs)
3. **Phase 3: Secret Version History & Rollback** (Data safety & security)
4. **Phase 4: Team Workspaces & RBAC** (Multi-user capability)
5. **Phase 5: Webhooks & Slack/Discord Alerts** (Real-time monitoring)
6. **Phase 6: Stripe Billing & Plan Limits** (Monetization & SaaS gating)
