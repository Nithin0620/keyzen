# 🔐 Keyzen

> **Developer-First Secrets Management Platform**  
> Zero-Disk secret injection, AES-256-GCM envelope encryption, Apollo GraphQL Management API, high-throughput Fastify REST Runtime, Supabase PostgreSQL, and official CLI + SDK.

---

## 🏗 System Architecture

```
                  ┌────────────────────────────────────────┐
                  │          Keyzen Web Dashboard          │
                  │ (Next.js 14 + Tailwind + Apollo Client)│
                  └───────────────────┬────────────────────┘
                                      │
                               GraphQL API (/graphql)
                                      │
┌───────────────────────────────┐     │
│   Developer CLI / Node SDK    │     │
│  `keyzen run -- npm start`    │     │
└───────────────┬───────────────┘     │
                │                     │
      REST API (/api/v1/resolve)      │
                │                     │
         ┌──────▼─────────────────────▼──────┐
         │         Keyzen Backend            │
         │   (Fastify + Apollo Server v4)    │
         └─────────────────┬─────────────────┘
                           │
                 Envelope Cryptography
                     (AES-256-GCM)
                           │
         ┌─────────────────▼─────────────────┐
         │        Supabase PostgreSQL        │
         │  (Ciphertext + IV + AuthTag Only) │
         └───────────────────────────────────┘
```

---

## 📦 Monorepo Structure

```
keyzen/
├── apps/
│   ├── api/             # Fastify + Apollo Server v4 (GraphQL + REST Runtime)
│   └── web/             # Next.js 14 Management Dashboard (Black & Light Green aesthetic)
├── packages/
│   ├── cli/             # `keyzen` CLI (`login`, `run`, `get`, `export`)
│   ├── crypto/          # AES-256-GCM Envelope Encryption & HKDF Key Engine
│   ├── db/              # Supabase PostgreSQL schema with Drizzle ORM
│   └── sdk-node/        # Official `@keyzen/node` client library with RAM cache
└── examples/
    └── sample-node-app/ # Example application demonstrating zero-disk injection
```

---

## ⚡ Quick Start

### 1. Install dependencies & build
```bash
pnpm install
pnpm build
```

### 2. Run Tests
```bash
pnpm test
```

### 3. Start Development Servers
```bash
# Starts both Fastify API (:4000) and Web Dashboard (:3000)
pnpm dev
```

---

## 💻 Developer CLI Usage

### Authenticate
```bash
keyzen login kzn_prod_your_service_token
```

### Zero-Disk Injection (`keyzen run`)
Run any application without keeping `.env` files on disk:
```bash
keyzen run -- npm start
keyzen run -- node server.js
keyzen run -- python main.py
```

### Get a single secret
```bash
keyzen get STRIPE_SECRET_KEY
```

### Export (for CI/CD fallback)
```bash
keyzen export --format env > .env.local
```

---

## 🛠 Node.js SDK Usage (`@keyzen/node`)

```typescript
import { Keyzen } from '@keyzen/node';

const keyzen = new Keyzen({
  token: process.env.KEYZEN_TOKEN, // Scoped service token
});

// 1. Get a specific secret
const stripeKey = await keyzen.get('STRIPE_SECRET_KEY');

// 2. Or inject all secrets directly into process.env in-memory
await keyzen.injectEnv();
console.log(process.env.DATABASE_URL);
```

---

## 🔒 Security Model

- **No Plaintext in DB:** Supabase only stores `ciphertext`, `iv`, and `auth_tag`.
- **Envelope Encryption:** Project keys are derived via HKDF-SHA256 from a root Master Key and unique project identifiers.
- **Strict Separation:** GraphQL metadata queries only return key names and version history; decrypted values require privileged calls with immutable audit logs.

---

## 📜 Project Status

Keyzen is under active development. The crypto engine, database schema, backend API, Node SDK, and CLI are implemented and passing tests. Expect breaking changes.

---

## 🤝 Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow and conventions, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community guidelines.

**Do not open a public issue for security vulnerabilities** — follow [SECURITY.md](SECURITY.md) instead.

---

## 📄 License

Released under the [MIT License](LICENSE).

Copyright © 2026 KS Nithin

