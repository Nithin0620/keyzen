import type { ReactNode } from 'react';
import { Code2, RefreshCw, Server, ShieldCheck, Timer } from 'lucide-react';
import { CodeBlock, DocCallout, DocsHero, DocsSection, FieldTable } from '@/components/docs/docs-primitives';

const installCode = `npm install aegis`;

const importCode = `import { Aegis } from 'aegis';

const { Aegis } = require('aegis');`;

const createCode = `import { Aegis } from 'aegis';

export const aegis = new Aegis({
  projectId: process.env.AEGIS_PROJECT_ID!,
  environment: process.env.AEGIS_ENVIRONMENT!,
  apiKey: process.env.AEGIS_SERVICE_TOKEN!,
  endpoint: process.env.AEGIS_API_URL,
  cacheTtlMs: 60_000,
  timeoutMs: 5_000,
  retries: 2,
});`;

const lifecycleCode = `await aegis.init();

const apiKey = aegis.get('API_KEY');
const allSecrets = aegis.getAll();

await aegis.sync(['API_KEY', 'DATABASE_URL']);
await aegis.inject(['API_KEY']);

const exitCode = await aegis.run(['node', 'server.js']);
aegis.disconnect();`;

const errorCode = `import { Aegis, AegisAuthenticationError, AegisError } from 'aegis';

try {
  await aegis.validate();
} catch (error) {
  if (error instanceof AegisAuthenticationError) {
    console.error('Rotate the service token and restart the process.');
  } else if (error instanceof AegisError) {
    console.error(error.code, error.message);
  }
  throw error;
}`;

export default function SdkDocsPage(): ReactNode {
  return (
    <>
      <DocsHero
        eyebrow="Documentation / SDK"
        title="The Aegis SDK, method by method."
        description="One small class for server-side Node.js. It validates a scoped token, fetches secrets, caches them for a short time, and can inject them into a child process."
      />

      <DocsSection
        id="install"
        eyebrow="Install"
        title="Add the package"
        description="The package ships TypeScript types plus ESM and CommonJS builds. It is server-only by design."
      >
        <div className="space-y-4">
          <CodeBlock title="Terminal" code={installCode} />
          <CodeBlock title="ESM and CommonJS" code={importCode} language="typescript" />
          <DocCallout tone="warning" title="Server-side Node.js only">
            Importing the SDK in a browser or bundled client context throws <code>AegisServerOnlyError</code>. Secret values must never reach a browser bundle.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="create-client"
        eyebrow="Configuration"
        title="Create a client"
        description="You can pass everything directly, or let the SDK read standard environment variables."
      >
        <div className="space-y-5">
          <CodeBlock title="aegis.ts" code={createCode} language="typescript" />
          <FieldTable
            rows={[
              { name: 'projectId', type: 'string', description: 'Required. The project the service token belongs to.' },
              { name: 'environment', type: 'string', description: 'Required. The environment label used by your app.' },
              { name: 'apiKey', type: 'string', defaultValue: 'AEGIS_SERVICE_TOKEN', description: 'Optional service token. Omit it to read AEGIS_SERVICE_TOKEN; when set here it wins.' },
              { name: 'endpoint', type: 'string', defaultValue: 'AEGIS_API_URL or http://localhost:3001', description: 'API base URL. Trailing slashes are removed automatically.' },
              { name: 'cacheTtlMs', type: 'number', defaultValue: '60000', description: 'How long fetched secrets stay fresh in memory. Must be a non-negative integer.' },
              { name: 'timeoutMs', type: 'number', defaultValue: '5000', description: 'Per-request timeout. Must be a positive integer.' },
              { name: 'retries', type: 'number', defaultValue: '2', description: 'Retries for 429 and 5xx responses. Must be between 0 and 5.' },
            ]}
          />
          <DocCallout tone="tip" title="apiKey is optional">
            If you omit <code>apiKey</code>, the SDK reads <code>AEGIS_SERVICE_TOKEN</code> from the environment. Set <code>apiKey</code> explicitly only when you want that value to win.
          </DocCallout>
          <DocCallout tone="tip" title="Token scope wins">
            The service token is bound to one project and one environment. The SDK checks that the configured project matches the token; the API enforces the real environment scope.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="methods"
        eyebrow="API reference"
        title="Every method"
        description="All network methods are async. Cache readers are synchronous and never make a request."
      >
        <div className="space-y-4">
          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Server className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">await aegis.init()</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Calls <code>validate()</code> then <code>sync()</code>. Use this once during startup when you want the cache ready before handling traffic.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">await aegis.validate()</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Checks the service token and project scope. Returns <code>true</code> or throws. The response contains no secret values.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <RefreshCw className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">await aegis.sync(names?)</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Fetches secrets into the in-memory cache. Pass an array of uppercase names to fetch only those secrets; omit it to fetch all secrets in the token environment. The previous cache is cleared first.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Code2 className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">aegis.get(name)</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Reads one value from the cache. Returns <code>undefined</code> when the name is missing or the cache has expired. Call <code>sync()</code> first.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Code2 className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">aegis.getAll()</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Returns a frozen record of every cached secret. Use it for inspection or to build an app configuration object; it never fetches.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Timer className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">await aegis.inject(names?)</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Runs <code>sync()</code>, then writes the fetched values into <code>process.env</code>. Names starting with <code>AEGIS_</code> and sensitive loader variables are rejected.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Server className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">await aegis.run(args)</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">
              Fetches all secrets, strips <code>AEGIS_*</code> from the child environment, injects the secrets, starts the child process, and resolves with its exit code.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <RefreshCw className="size-4 text-peri-2" />
              <code className="font-mono text-sm text-ink">aegis.disconnect()</code>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-2">Clears the in-memory cache immediately. There is no open socket to close.</p>
          </div>

          <CodeBlock title="Typical lifecycle" code={lifecycleCode} language="typescript" />
        </div>
      </DocsSection>

      <DocsSection
        id="cache"
        eyebrow="Cache and safety"
        title="What happens to values"
        description="The SDK keeps plaintext only in process memory for the configured cache window."
      >
        <div className="space-y-4">
          <DocCallout tone="security" title="Encrypted in Aegis, plaintext only in your server memory">
            The SDK receives decrypted values over TLS after the service token is authorized. It never receives encryption keys and never writes values to disk.
          </DocCallout>
          <FieldTable
            rows={[
              { name: 'sync()', type: 'network', description: 'Replaces the entire cache with the fetched result.' },
              { name: 'get() / getAll()', type: 'memory', description: 'Read from cache only. Expired caches are cleared before reading.' },
              { name: 'inject()', type: 'process.env', description: 'Writes fetched values into the current Node process.' },
              { name: 'run()', type: 'child process', description: 'Injects values into a spawned child and removes AEGIS_* variables.' },
              { name: 'disconnect()', type: 'memory', description: 'Clears all cached values.' },
            ]}
          />
          <DocCallout tone="warning" title="Blocked secret names">
            Names must match uppercase environment-variable syntax. Names beginning with <code>AEGIS_</code> and loader variables such as <code>PATH</code> or <code>NODE_OPTIONS</code> are rejected.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="errors"
        eyebrow="Errors"
        title="Typed failures, no guesswork"
        description="Every SDK error extends AegisError and has a stable code."
      >
        <div className="space-y-5">
          <FieldTable
            rows={[
              { name: 'AegisConfigError', type: 'CONFIG', description: 'Missing project, environment, token, or invalid option.' },
              { name: 'AegisInputError', type: 'INPUT', description: 'Invalid secret names or more than 200 requested names.' },
              { name: 'AegisAuthenticationError', type: 'AUTHENTICATION', description: 'Token rejected, revoked, expired, or out of scope.' },
              { name: 'AegisRateLimitError', type: 'RATE_LIMITED', description: 'The API kept returning 429 after all retries.' },
              { name: 'AegisNetworkError', type: 'NETWORK', description: 'Timeout, connection failure, or repeated 5xx response.' },
              { name: 'AegisResponseError', type: 'RESPONSE', description: 'Unexpected response body or blocked secret name.' },
              { name: 'AegisCommandError', type: 'COMMAND', description: 'run() was called without a command or could not spawn it.' },
              { name: 'AegisServerOnlyError', type: 'SERVER_ONLY', description: 'The SDK was imported in a browser-like context.' },
            ]}
          />
          <CodeBlock title="Handle auth failures" code={errorCode} language="typescript" />
          <DocCallout tone="tip" title="Retries are bounded">
            Only 429 and 5xx responses are retried. Authentication failures, bad input, and malformed responses fail immediately.
          </DocCallout>
        </div>
      </DocsSection>
    </>
  );
}
