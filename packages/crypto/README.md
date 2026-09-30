# @keyzen/crypto

AES-256-GCM envelope encryption and key management for
[Keyzen](https://github.com/Nithin0620/keyzen).

Secret values are encrypted with a per-project Data Encryption Key derived from a
master key via HKDF-SHA256. Nothing is stored or logged in plaintext.

## Install

```bash
pnpm add @keyzen/crypto
```

## Usage

### Key management

```typescript
import { generateProjectKey, deriveProjectKey } from '@keyzen/crypto';

// Random 256-bit key
const key = generateProjectKey();

// Deterministic per-project key derived from a master key.
// The salt and info string are both bound to the project ID, so keys cannot
// be derived for one project from another project's context.
const projectKey = deriveProjectKey(masterKey, 'project-abc123');
```

### Encrypting and decrypting

```typescript
import { encryptSecret, decryptSecret } from '@keyzen/crypto';

const payload = await encryptSecret(plaintext, projectKey, 'project-abc123');
// payload => { ciphertext, iv, authTag } — hex encoded

const value = await decryptSecret(payload, projectKey, 'project-abc123');
```

The optional third argument is **additional authenticated data (AAD)**. When
supplied it must be identical for encryption and decryption. This binds the
ciphertext to its context so it cannot be replayed against a different project
or environment — decrypting with the wrong AAD throws.

Decryption throws if the ciphertext or auth tag has been modified.

### Service tokens

```typescript
import { generateServiceToken, hashToken } from '@keyzen/crypto';

const { token, hash } = generateServiceToken('prod');
// token => "kzn_prod_<192-bit random, base64url>"
// hash  => "<sha256 hex>"

hashToken(token) === hash; // true
```

Show `token` to the user once. Store **only** `hash` — tokens are looked up by
hash, so a database leak yields nothing usable.

## API

| Function | Description |
| --- | --- |
| `encryptSecret(plaintext, key, aad?)` | AES-256-GCM encryption. Returns `{ ciphertext, iv, authTag }` as hex. |
| `decryptSecret(payload, key, aad?)` | Decrypts a payload. Throws on tampering or wrong key/AAD. |
| `generateProjectKey()` | Generates a random 32-byte key. |
| `deriveProjectKey(masterKey, projectId)` | HKDF-SHA256 key derivation, 32 bytes. |
| `hashToken(token)` | SHA-256 hex digest of a token. |
| `generateServiceToken(environment?)` | Mints a `kzn_*` token and its hash. |

Key length is validated — anything other than 32 bytes throws.

## Testing

```bash
pnpm --filter @keyzen/crypto test
```

## License

[MIT](../../LICENSE)
