import type { ReactNode } from 'react';
import { KeyRound, LockKeyhole, ScanEye, Server, ShieldCheck } from 'lucide-react';
import { CheckList, DocCallout, DocCard, DocsHero, DocsSection, FieldTable } from '@/components/docs/docs-primitives';

export default function SecurityDocsPage(): ReactNode {
  return (
    <>
      <DocsHero
        eyebrow="Documentation / Security"
        title="Safe by default, explicit by design."
        description="Aegis is built around one rule: the tenant boundary is the workspace, and secret values only leave the API for an authorized server process."
      />

      <DocsSection
        id="boundary"
        eyebrow="Trust boundary"
        title="What the SDK never receives"
        description="The SDK receives secret values, never the keys that encrypt them. Encryption, decryption, and key rotation stay server-side."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <DocCard title="No key material" description="Clients never receive encryption keys, KMS credentials, or ciphertext." icon={<LockKeyhole className="size-4" />} />
          <DocCard title="No browser secrets" description="The SDK refuses to run in a browser-like context and throws SERVER_ONLY." icon={<Server className="size-4" />} />
          <DocCard title="No values in URLs" description="Runtime requests use JSON bodies and Bearer tokens. Values are never query parameters." icon={<ScanEye className="size-4" />} />
        </div>
      </DocsSection>

      <DocsSection
        id="tokens"
        eyebrow="Service tokens"
        title="Short-lived, scoped, revocable"
        description="A service token is the only credential the SDK or CLI needs."
      >
        <div className="space-y-5">
          <FieldTable
            rows={[
              { name: 'Scope', type: 'project + environment', description: 'A token cannot read another project or environment.' },
              { name: 'Storage', type: 'hash only', description: 'The plaintext token is shown once. Aegis stores a SHA-256 hash.' },
              { name: 'Expiry', type: '1 to 365 days', description: 'Every token has an expiry chosen when it is created or rotated.' },
              { name: 'Rotation', type: 'one action', description: 'Rotation creates a new token and immediately invalidates the old one.' },
              { name: 'Revocation', type: 'immediate', description: 'Revoke blocks the token through the shared revocation cache.' },
            ]}
          />
          <DocCallout tone="security" title="Use one token per deployment">
            Separate tokens make rotation and revocation precise. Never share a token between production and staging, and never commit one to source control.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="rbac"
        eyebrow="People"
        title="Explicit access at both levels"
        description="Workspace membership and project membership are separate. Being a workspace owner does not silently grant every project."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Workspace roles" description="OWNER, ADMIN, MEMBER, and VIEWER control workspace settings and invitations." icon={<ShieldCheck className="size-4" />} />
          <DocCard title="Project roles" description="OWNER, ADMIN, DEVELOPER, and VIEWER control project secrets and environments." icon={<KeyRound className="size-4" />} />
          <DocCard title="Custom permissions" description="Grant members.invite for delegated project administration without full ownership." icon={<ShieldCheck className="size-4" />} />
          <DocCard title="Deny by default" description="Routes are guarded unless explicitly marked public in one place." icon={<LockKeyhole className="size-4" />} />
        </div>
      </DocsSection>

      <DocsSection
        id="audit"
        eyebrow="Audit trail"
        title="Every important action is attributed"
        description="Secret reads and writes, token actions, membership changes, and webhook events are recorded with a real actor."
      >
        <CheckList
          items={[
            'Actor is a real user or a service token ID',
            'Audit writes complete before the request succeeds',
            'Client IP addresses are stored as hashes',
            'Secret values are not written to audit records',
            'Webhook callbacks are signed with a per-project secret',
          ]}
        />
      </DocsSection>

      <DocsSection
        id="runtime"
        eyebrow="Runtime API"
        title="Two endpoints, minimal output"
        description="The SDK and CLI only need validation and resolution."
      >
        <FieldTable
          rows={[
            { name: 'GET /v1/validate', type: 'service token', description: 'Returns token scope and expiry. Contains no secret values.' },
            { name: 'POST /v1/secrets/resolve', type: 'service token', description: 'Returns only the requested secrets allowed by the token scope.' },
          ]}
        />
      </DocsSection>

      <DocsSection
        id="checklist"
        eyebrow="Production checklist"
        title="Before you ship"
        description="These are the controls that matter most for a first production rollout."
      >
        <CheckList
          items={[
            'Use HTTPS for AEGIS_API_URL',
            'Inject AEGIS_SERVICE_TOKEN from a secret manager',
            'Use a separate token and environment per deployment',
            'Set a short cache TTL and call disconnect on shutdown',
            'Prefer run() or SDK reads over printing pull output in logs',
            'Rotate tokens on a schedule and revoke unused ones',
            'Keep webhook endpoints HTTPS and verify signatures',
          ]}
        />
      </DocsSection>
    </>
  );
}
