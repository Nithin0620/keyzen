import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Code2, KeyRound, Layers, ShieldCheck, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckList, CodeBlock, DocCard, DocsHero, DocsSection, StepCard } from '@/components/docs/docs-primitives';

const installCode = `npm install aegis`;

const serverCode = `import { Aegis } from 'aegis';

const aegis = new Aegis({
  projectId: process.env.AEGIS_PROJECT_ID!,
  environment: process.env.AEGIS_ENVIRONMENT!,
  endpoint: process.env.AEGIS_API_URL,
});

await aegis.init();

const apiKey = aegis.get('API_KEY');
if (!apiKey) {
  throw new Error('API_KEY is not available');
}`;

const cliCode = `aegis init \\
  --project "$AEGIS_PROJECT_ID" \\
  --environment "$AEGIS_ENVIRONMENT" \\
  --endpoint "$AEGIS_API_URL"

aegis validate
aegis pull --format json
aegis run -- node server.js`;

export default function DocsPage(): ReactNode {
  return (
    <>
      <DocsHero
        eyebrow="Documentation / Start here"
        title="Secrets in your app, without secrets on disk."
        description="Aegis gives every service a short-lived token. The SDK exchanges that token for the exact secrets it needs, decrypts them on the server, and keeps them in memory only."
      >
        <Button asChild>
          <Link href="/auth/signup">
            Create a workspace
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="glass">
          <Link href="/docs/sdk">Read the SDK reference</Link>
        </Button>
      </DocsHero>

      <DocsSection
        id="mental-model"
        eyebrow="Mental model"
        title="Five pieces, one boundary"
        description="Everything is scoped by workspace. A service token can only reach one project and one environment inside that workspace."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DocCard title="User" description="Signs in and belongs to workspaces." icon={<KeyRound className="size-4" />} />
          <DocCard title="Workspace" description="The tenant boundary for people, projects, and audit logs." icon={<Layers className="size-4" />} />
          <DocCard title="Project" description="Groups environments, secrets, tokens, and webhooks." icon={<Code2 className="size-4" />} />
          <DocCard title="Environment" description="A separate value set such as production or staging." icon={<Zap className="size-4" />} />
          <DocCard title="Secret" description="An encrypted name and value, decrypted only by the API." icon={<ShieldCheck className="size-4" />} />
        </div>
      </DocsSection>

      <DocsSection
        id="before-you-start"
        eyebrow="Checklist"
        title="What you need first"
        description="The dashboard setup takes less than two minutes. After that, the CLI and SDK do the runtime work."
      >
        <CheckList
          items={[
            'An Aegis account and an active workspace',
            'A project with at least one environment',
            'At least one secret saved in that environment',
            'A service token scoped to that project and environment',
            'Your server or CI platform able to inject environment variables',
            'Node.js 20 or newer for the SDK and CLI',
          ]}
        />
      </DocsSection>

      <DocsSection
        id="quickstart"
        eyebrow="Quickstart"
        title="Go from dashboard to running app"
        description="Follow this once. Every later project uses the same pattern."
      >
        <div className="space-y-4">
          <StepCard
            number="01"
            title="Create the secret in the dashboard"
            description="Open your workspace, choose the project, then add a secret in the selected environment. Use uppercase names such as API_KEY or DATABASE_URL."
          />
          <StepCard
            number="02"
            title="Create a service token"
            description="In the project, open Service Tokens and create a token for the same environment. Copy the token when it is shown once; Aegis stores only its hash afterward."
          />
          <StepCard
            number="03"
            title="Inject token configuration into your runtime"
            description="Set AEGIS_SERVICE_TOKEN in your platform secret store. Set AEGIS_PROJECT_ID, AEGIS_ENVIRONMENT, and AEGIS_API_URL as normal configuration. Never commit the token."
          />
          <StepCard number="04" title="Install the SDK" description="Install the published package in your Node.js service.">
            <CodeBlock title="Install the package" code={installCode} />
          </StepCard>
          <StepCard
            number="05"
            title="Read secrets at startup"
            description="init() validates the token and fills the in-memory cache. get() reads from that cache and never makes a network call."
          >
            <CodeBlock title="server.ts" code={serverCode} language="typescript" />
          </StepCard>
          <StepCard
            number="06"
            title="Use the CLI for local work and CI"
            description="Point the CLI at the same environment, validate the token, inspect names and values for debugging, or run a child process with secrets injected in memory."
          >
            <CodeBlock title="Terminal" code={cliCode} />
          </StepCard>
        </div>
      </DocsSection>

      <DocsSection
        id="next"
        eyebrow="Next"
        title="Choose your depth"
        description="Start with the reference you need, then read the security model before production."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <DocCard title="SDK reference" description="Every constructor option, method, error, and caching rule." icon={<Code2 className="size-4" />}>
            <Link href="/docs/sdk" className="inline-flex items-center gap-2 text-sm text-peri-2 hover:underline">
              Open SDK reference <ArrowRight className="size-4" />
            </Link>
          </DocCard>
          <DocCard title="CLI reference" description="Every command, flag, environment variable, and output format." icon={<Terminal className="size-4" />}>
            <Link href="/docs/cli" className="inline-flex items-center gap-2 text-sm text-peri-2 hover:underline">
              Open CLI reference <ArrowRight className="size-4" />
            </Link>
          </DocCard>
          <DocCard title="Security model" description="Token scope, server-only behavior, revocation, and safe rollout." icon={<ShieldCheck className="size-4" />}>
            <Link href="/docs/security" className="inline-flex items-center gap-2 text-sm text-peri-2 hover:underline">
              Open security model <ArrowRight className="size-4" />
            </Link>
          </DocCard>
        </div>
      </DocsSection>
    </>
  );
}
