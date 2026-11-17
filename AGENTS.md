# Repository guidance

Read `docs/PLAN.md` before making changes. It defines the target architecture, phase order and the security invariants every change must preserve.

## Rules

- Workspace is the tenant boundary. Scope every query by a verified `workspaceId`; never trust IDs from request bodies.
- Deny by default. New routes must be explicitly guarded or explicitly whitelisted as public in one place.
- Secrets are decrypted server-side only. Never send keys to the SDK, never log values, never put values in URLs or error messages.
- Audit writes are awaited and attributed to a real actor.
- No fake data, no placeholder credentials, no hardcoded secret/key fallbacks outside development.
- Prisma schema changes require a migration; do not hand-edit generated client code.
- Every new endpoint or permission change needs a test in the same change.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm db:migrate
pnpm db:generate
```

Never commit `.env`. Review diffs for secrets before staging.
