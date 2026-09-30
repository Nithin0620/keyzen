# Contributing to Keyzen

Thanks for your interest in improving Keyzen. This document covers the workflow
and expectations for contributions.

## Getting Started

```bash
git clone https://github.com/Nithin0620/keyzen.git
cd keyzen
pnpm install
pnpm test
```

Requirements: Node.js 20+ and pnpm 9+.

## Workflow

1. Open an issue first for anything beyond a small fix, so the approach can be
   discussed before you invest time in it.
2. Branch from `master` with a descriptive name:
   - `feat/cli-run-command`
   - `fix/gcm-auth-tag-validation`
   - `docs/graphql-examples`
3. Make your change, keeping the commit focused.
4. Verify it passes:
   ```bash
   pnpm lint
   pnpm build
   pnpm test
   ```
5. Push and open a pull request describing what changed and why.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

| Type | Use for |
| --- | --- |
| `feat` | New functionality |
| `fix` | Bug fixes |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `refactor` | No behavior change |
| `chore` | Tooling, deps, config |
| `perf` | Performance improvements |

Examples:

```
feat(crypto): add HKDF-based key rotation
fix(api): scope service tokens to a single environment
docs(readme): document key derivation
```

## Code Style

- **TypeScript strict mode is mandatory.** No `any` in exported signatures.
- Match the surrounding code style; do not reformat unrelated lines.
- Keep public APIs typed and documented with JSDoc where the intent is not obvious.
- Follow the project plan in `docs/superpowers/plans/` for the intended design of
  any component you are touching.
- Prefer named exports over default exports in packages.

## Testing

- New behavior needs a test. Bug fixes need a test that fails before the fix.
- Use [Vitest](https://vitest.dev). Test files live in `tests/` inside each
  package.
- Run a single package's tests with:
  ```bash
  pnpm --filter @keyzen/crypto test
  ```

## Security

Do not report vulnerabilities publicly. See [SECURITY.md](SECURITY.md).

## Code of Conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
