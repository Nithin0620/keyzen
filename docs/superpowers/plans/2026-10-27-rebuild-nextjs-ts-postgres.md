# Rebuild Keyzen: Single Next.js + TypeScript + PostgreSQL Architecture

## Goal
Rebuild Keyzen from a multi-package Turborepo (Fastify + Apollo GraphQL + Apollo Client + separate web & db packages) into a single, clean, minimal Next.js 14+ full-stack application using TypeScript, PostgreSQL (Supabase), and standard Node.js crypto.

## Architecture & Simplifications
- **Single Root Application**: Drop Turborepo, pnpm workspaces, and multi-package boilerplate.
- **REST & Server Actions over GraphQL**: Replace Apollo Server and Apollo Client with Next.js App Router Route Handlers (`/api/...`) and React Server Components/Actions.
- **Node.js Stdlib Cryptography**: Re-use AES-256-GCM envelope encryption directly in `lib/crypto.ts`.
- **Drizzle ORM + Supabase PostgreSQL**: Schema consolidated in `lib/schema.ts` and `lib/db.ts`, preserving 100% compatibility with existing Supabase tables.
- **Standalone CLI**: Minimal script in `cli/index.ts` supporting `keyzen login`, `keyzen run`, and `keyzen get`.

---

## Proposed File Map

```text
keyzen/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                           # Landing / redirect to dashboard
│   ├── globals.css                        # Tailwind styles
│   ├── dashboard/
│   │   ├── page.tsx                       # Projects & environments overview
│   │   └── [projectId]/
│   │       └── page.tsx                   # Secret management & injection tokens
│   └── api/
│       ├── projects/route.ts              # Projects CRUD
│       ├── secrets/route.ts               # Secrets create / update / delete
│       └── v1/
│           ├── resolve/route.ts           # Zero-Disk secret resolution for CLI/SDK
│           └── tokens/route.ts            # Service token creation / verification
├── lib/
│   ├── db.ts                              # Drizzle DB client with postgres connection
│   ├── schema.ts                          # Drizzle schema (organizations, projects, secrets, etc.)
│   └── crypto.ts                          # AES-256-GCM envelope encryption & decryption
├── cli/
│   └── index.ts                           # Standalone CLI binary ('keyzen run -- <cmd>')
├── .env                                   # DATABASE_URL + KEYZEN_MASTER_KEY
├── package.json                           # Single root package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## Tasks

### Task 1: Initialize Root `package.json` & Configuration
- **Files**: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- Set up root dependencies: `next`, `react`, `react-dom`, `drizzle-orm`, `postgres`, `lucide-react`, `tailwindcss`, `typescript`, `@types/node`, `@types/react`.
- Set up CLI script entry point.
- **Verify**: `pnpm install` succeeds cleanly.

### Task 2: Core Library (`lib/crypto.ts`, `lib/schema.ts`, `lib/db.ts`)
- **Files**: `lib/crypto.ts`, `lib/schema.ts`, `lib/db.ts`
- Port AES-256-GCM envelope encryption and key derivation into `lib/crypto.ts`.
- Consolidate Drizzle tables into `lib/schema.ts` matching existing Supabase schema.
- Instantiate Drizzle client in `lib/db.ts` using `process.env.DATABASE_URL`.
- **Verify**: Test script connecting to Supabase and performing a round-trip encrypt -> decrypt.

### Task 3: API Route Handlers
- **Files**: `app/api/v1/resolve/route.ts`, `app/api/secrets/route.ts`, `app/api/projects/route.ts`
- Implement `POST /api/v1/resolve` for token-authenticated secret injection.
- Implement `GET` and `POST` for projects and secrets.
- **Verify**: Direct curl / fetch test against `/api/v1/resolve` returns decrypted environment variables for a valid service token.

### Task 4: Web Dashboard UI
- **Files**: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/[projectId]/page.tsx`
- Build dashboard with project list, environment switcher (`dev`, `staging`, `prod`), secret editor, and service token generator.
- Retain the sleek dark aesthetic.
- **Verify**: `pnpm build` builds the Next.js app without TypeScript or linting errors.

### Task 5: Minimal Standalone CLI
- **Files**: `cli/index.ts`
- Implement `keyzen login <token>`, `keyzen run -- <command>`, and `keyzen get <key>`.
- Zero-disk injection runs child processes with decrypted secrets in `process.env`.
- **Verify**: Test `keyzen run` against a sample Node command.

### Task 6: Cleanup Old Monorepo Folders
- Remove legacy `apps/` and `packages/` directories, `turbo.json`, and `pnpm-workspace.yaml`.
- Ensure clean Git diff and verified passing build.
