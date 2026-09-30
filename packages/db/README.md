# @keyzen/db

Drizzle ORM schema and PostgreSQL client for
[Keyzen](https://github.com/Nithin0620/keyzen).

Targets Supabase (PostgreSQL). The client is configured for the Supabase
transaction pooler, so it works on either a pooler (port 6543) or direct
connection.

## Install

```bash
pnpm add @keyzen/db
```

## Schema

| Table | Purpose |
| --- | --- |
| `organizations` | Tenant root — name and slug |
| `org_members` | Membership with RBAC role (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) |
| `projects` | Belongs to an organization — name, slug, description |
| `environments` | Belongs to a project — `dev`, `staging`, or `prod` |
| `secrets` | Secret name and comment metadata (never values). Unique per `(project, name)` |
| `secret_values` | Per-environment encrypted value: `ciphertext`, `iv`, `auth_tag`, `version`. Unique per `(secret, environment)` |
| `service_tokens` | Scoped runtime tokens — stores `token_hash` + `token_prefix`, never the full token |
| `audit_logs` | Append-only record of actor, action, metadata, IP, and user agent |

Relationship: `organizations` → `projects` → `environments` → `secret_values`,
with `secrets` as the logical key shared across environments.

**Secrets are never stored in plaintext.** `secrets` holds metadata only;
`secret_values` holds only encrypted output from `@keyzen/crypto`. Service tokens
are stored as a SHA-256 `token_hash` alongside a short `token_prefix` for
display; the full token is shown once at creation and never persisted.

Deleting an organization or project cascades to its projects, environments,
secrets, and tokens.

### Audit actions

`audit_logs.action` records one of `SECRET_CREATE`, `SECRET_UPDATE`,
`SECRET_REVEAL`, `SECRET_RESOLVE`, `TOKEN_CREATE`, `TOKEN_REVOKE`, with
`actorType` distinguishing `USER`, `SERVICE_TOKEN`, and `SYSTEM`.

## Usage

```typescript
import { createDatabaseClient, schema } from '@keyzen/db';
import { eq } from 'drizzle-orm';

const db = createDatabaseClient();

const projects = await db.query.projects.findMany({
  where: eq(schema.projects.orgId, orgId),
});
```

The schema is also importable directly:

```typescript
import { schema } from '@keyzen/db/schema';
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/keyzen` | PostgreSQL connection string |

## Migrations

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/keyzen"
pnpm --filter @keyzen/db generate   # generate migrations from schema
pnpm --filter @keyzen/db migrate    # apply pending migrations
```

## License

[MIT](../../LICENSE)
