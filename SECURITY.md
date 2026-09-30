# Security Policy

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Keyzen manages encryption keys and secret material. If you find a flaw, report it
privately so it can be fixed before disclosure.

Email **nithin30302@gmail.com** with:

- A description of the vulnerability and its impact
- Steps to reproduce, or a proof of concept
- The affected package, version, or commit
- Any suggested remediation

You can expect an acknowledgement within 72 hours. Valid reports are tracked in
a private advisory until a fix is released, and you will be credited in the
advisory unless you prefer otherwise.

Please give the maintainer a reasonable window to release a fix before
disclosing publicly.

## Scope

The following are in scope and taken seriously:

- Any weakness that allows plaintext secrets to leak (logs, error messages,
  API responses, audit records, telemetry)
- Forging, recovering, or brute-forcing service tokens or project encryption keys
- Tampering with ciphertext without detection
- Authentication or authorization bypasses on secret resolution
- Cross-project or cross-tenant key derivation / decryption

Out of scope:

- Vulnerabilities in third-party dependencies (report these upstream)
- Findings from automated scanners without a demonstrated impact
- Denial of service through volumetric attacks against Keyzen's own infrastructure

## Handling Secrets Safely

If you are contributing:

- Never commit real secrets, keys, tokens, or `.env` files
- Use clearly fake placeholders in tests and examples
- Keep the master key out of the repository — it belongs in your deployment's
  secret store
- Remember that the crypto package handles key material; avoid logging key
  buffers, plaintext, or decrypted values, even in debug statements
