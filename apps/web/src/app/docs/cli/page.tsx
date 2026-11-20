import type { ReactNode } from 'react';
import { CodeBlock, DocCallout, DocsHero, DocsSection, FieldTable } from '@/components/docs/docs-primitives';

const initCode = `npx aegis init \\
  --project "$AEGIS_PROJECT_ID" \\
  --environment "$AEGIS_ENVIRONMENT" \\
  --endpoint "$AEGIS_API_URL"`;

const pullCode = `aegis validate
aegis pull --format json
aegis pull --format env --name API_KEY
aegis pull --name API_KEY --name DATABASE_URL --format json`;

const runCode = `aegis run -- node server.js
aegis run -- npm start
aegis --timeout 10000 run -- node server.js`;

const ciCode = `aegis validate
aegis run -- npm start`;

export default function CliDocsPage(): ReactNode {
  return (
    <>
      <DocsHero
        eyebrow="Documentation / CLI"
        title="The Aegis CLI, command by command."
        description="Use the CLI to check a token, inspect secrets while debugging, or run any process with secrets injected in memory."
      />

      <DocsSection
        id="install"
        eyebrow="Install"
        title="Run it with npx or install globally"
        description="The CLI is included in the same aegis package as the SDK."
      >
        <CodeBlock title="Terminal" code={`npx aegis --version\nnpm install --global aegis\naegis --help`} />
      </DocsSection>

      <DocsSection
        id="configuration"
        eyebrow="Configuration"
        title="How the CLI finds its settings"
        description="Flags win over environment variables, which win over the saved config file."
      >
        <div className="space-y-5">
          <CodeBlock title="First-time setup" code={initCode} />
          <FieldTable
            rows={[
              { name: '--project', type: 'flag or AEGIS_PROJECT_ID', description: 'Project ID from your Aegis project.' },
              { name: '--environment', type: 'flag or AEGIS_ENVIRONMENT', description: 'Environment label for the service.' },
              { name: '--endpoint', type: 'flag or AEGIS_API_URL', description: 'API base URL.' },
              { name: '--timeout', type: 'flag', defaultValue: '5000', description: 'Request timeout in milliseconds.' },
              { name: 'AEGIS_SERVICE_TOKEN', type: 'environment variable', description: 'Service token used for every request.' },
              { name: 'XDG_CONFIG_HOME', type: 'environment variable', defaultValue: '~/.config', description: 'Base directory for the non-secret CLI config file.' },
            ]}
          />
          <DocCallout tone="security" title="The config file never stores the token">
            <code>aegis init</code> saves only project, environment, and endpoint. Keep the service token in your platform secret store as <code>AEGIS_SERVICE_TOKEN</code>, or use <code>aegis login</code> to store it in the OS keychain on your own machine.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="commands"
        eyebrow="Commands"
        title="Everything you can do"
        description="All commands accept the common flags shown above unless noted otherwise."
      >
        <FieldTable
          rows={[
            { name: 'aegis init', type: 'setup', description: 'Validates credentials and saves non-secret config.' },
            { name: 'aegis validate', type: 'check', description: 'Confirms the token is accepted and scoped to the configured project.' },
            { name: 'aegis pull', type: 'read', description: 'Fetches secrets and prints them to stdout. Does not write files.' },
            { name: 'aegis run', type: 'execute', description: 'Fetches secrets, injects them into a child process, and returns its exit code.' },
            { name: 'aegis login', type: 'local', description: 'Stores a service token in the OS keychain from the environment or a prompt.' },
            { name: 'aegis logout', type: 'local', description: 'Removes the stored token from the OS keychain.' },
            { name: 'aegis --version', type: 'info', description: 'Prints the installed CLI version.' },
            { name: 'aegis --help', type: 'info', description: 'Shows commands and flags.' },
          ]}
        />
      </DocsSection>

      <DocsSection
        id="pull"
        eyebrow="Pull"
        title="Inspect secrets without writing them"
        description="Use --format json for scripts and --format env for a readable shell view."
      >
        <div className="space-y-5">
          <CodeBlock title="Terminal" code={pullCode} />
          <FieldTable
            rows={[
              { name: '--format', type: 'json | env', defaultValue: 'json', description: 'JSON prints an entries array; env prints NAME=value lines.' },
              { name: '--name', type: 'string, repeatable', description: 'Include only that uppercase secret name. Repeat the flag for multiple names.' },
            ]}
          />
          <DocCallout tone="warning" title="Treat pull output as sensitive">
            Values are printed to stdout. Do not redirect them into logs, tickets, or source control. For running apps, prefer <code>aegis run</code> or the SDK.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="run"
        eyebrow="Run"
        title="Inject into any process"
        description="Everything after -- is passed to the child command unchanged."
      >
        <div className="space-y-5">
          <CodeBlock title="Terminal" code={runCode} />
          <DocCallout tone="security" title="Clean child environment">
            The CLI removes <code>AEGIS_*</code> variables from the child process and adds the fetched secrets. No secret is written to disk and no key material is sent to the CLI.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="ci"
        eyebrow="CI"
        title="A production-safe CI pattern"
        description="Inject the token from your CI secret store, validate it, then run the app."
      >
        <div className="space-y-5">
          <CodeBlock title="CI step" code={ciCode} />
          <DocCallout tone="tip" title="Use a dedicated service token">
            Give each deployment its own token and its own environment. Revoke that token when the deployment is retired.
          </DocCallout>
        </div>
      </DocsSection>

      <DocsSection
        id="errors"
        eyebrow="Errors"
        title="Machine-readable failures"
        description="The CLI writes errors as one JSON object on stderr and exits with a non-zero status."
      >
        <CodeBlock title="Error shape" code={`{"error":{"code":"AUTHENTICATION","message":"Aegis service token was rejected"}}`} language="json" />
      </DocsSection>
    </>
  );
}
