'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Shield,
  Copy,
  Check,
  ArrowRight,
  GitBranch,
  Layers,
  Container,
  Code2,
  Key,
  BookOpen,
} from 'lucide-react';

export default function CliGuidancePage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copySnippet = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const CodeSnippet = ({ code, index, title }: { code: string; index: number; title?: string }) => (
    <div className="rounded-xl border border-[#222222] bg-[#0c0c0c] overflow-hidden my-3">
      {title && (
        <div className="bg-[#141414] px-4 py-2 border-b border-[#222222] flex items-center justify-between text-xs font-mono text-gray-400">
          <span>{title}</span>
          <button
            onClick={() => copySnippet(code, index)}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
      <div className="p-4 font-mono text-xs sm:text-sm text-green-400 overflow-x-auto whitespace-pre">
        {code}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-4">
      {/* Header */}
      <div className="space-y-3 pb-6 border-b border-[#222222]">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono">
          <Terminal className="w-3.5 h-3.5" />
          <span>Keyzen CLI Guide &bull; v2.0</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Developer CLI Guidance
        </h1>
        <p className="text-sm text-gray-400 max-w-2xl">
          Everything you need to know to inject encrypted secrets directly into your development servers, Docker containers, and CI/CD pipelines with zero disk footprint.
        </p>
      </div>

      {/* Step 1: Installation & Authentication */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center justify-center font-mono">
            1
          </span>
          <span>Authentication</span>
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          First, generate a Service Token from your project settings in the{' '}
          <Link href="/dashboard" className="text-green-400 hover:underline">
            Dashboard
          </Link>
          . Then authenticate your local environment:
        </p>

        <CodeSnippet
          code="./cli/index.mjs login kzn_dev_your_service_token_here"
          index={1}
          title="Terminal — Save token locally (~/.keyzen/config.json)"
        />

        <p className="text-xs text-gray-500">
          Alternatively, you can export the environment variable{' '}
          <code className="text-gray-300 font-mono">KEYZEN_TOKEN</code> in your shell without running login.
        </p>
      </section>

      {/* Step 2: Zero-Disk Injection */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center justify-center font-mono">
            2
          </span>
          <span>Zero-Disk Injection (`keyzen run`)</span>
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Use the <code className="text-green-400 font-mono">run</code> command followed by <code className="text-green-400 font-mono">--</code> and the command you wish to execute. Keyzen fetches the decrypted environment variables into RAM and spawns the child process:
        </p>

        <div className="space-y-2">
          <CodeSnippet
            code="./cli/index.mjs run -- npm start"
            index={2}
            title="Node.js / Next.js Server"
          />
          <CodeSnippet
            code="./cli/index.mjs run -- python main.py"
            index={3}
            title="Python FastAPI / Django"
          />
          <CodeSnippet
            code="./cli/index.mjs run -- go run main.go"
            index={4}
            title="Go Application"
          />
        </div>

        <div className="p-4 rounded-xl bg-[#111111] border border-[#262626] text-xs text-gray-300 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-green-400" />
            <span>Why Zero-Disk?</span>
          </div>
          <p className="text-gray-400 leading-relaxed">
            Standard dotenv files reside on your hard drive, SSD, or container file layers where they can easily be committed to Git, leaked via backup images, or inspected by other users on shared servers. Keyzen resolves secrets directly into volatile process memory and garbage-collects them on process exit.
          </p>
        </div>
      </section>

      {/* Step 3: Fetching Single Secrets */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center justify-center font-mono">
            3
          </span>
          <span>Single Secret Resolution (`keyzen get`)</span>
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Need a quick database URL for a migration tool like Prisma or Drizzle Kit? Use <code className="text-green-400 font-mono">keyzen get</code>:
        </p>

        <CodeSnippet
          code="./cli/index.mjs get DATABASE_URL"
          index={5}
          title="Print single secret value to stdout"
        />
      </section>

      {/* Step 4: CI/CD Recipes */}
      <section className="space-y-6 pt-6 border-t border-[#222222]">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-green-400" />
          <span>CI/CD Integration Recipes</span>
        </h2>

        {/* GitHub Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>GitHub Actions Workflow</span>
          </h3>
          <p className="text-xs text-gray-400">
            Store only your service token in GitHub Repository Secrets (<code className="text-gray-300 font-mono">KEYZEN_TOKEN</code>), and let Keyzen inject everything at build/test time:
          </p>

          <CodeSnippet
            code={`name: CI Pipeline

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install

      # Zero-disk secret injection for integration tests
      - name: Run Test Suite
        env:
          KEYZEN_TOKEN: \${{ secrets.KEYZEN_TOKEN }}
          KEYZEN_ENDPOINT: https://your-keyzen-domain.com
        run: |
          ./cli/index.mjs run -- npm test`}
            index={6}
            title=".github/workflows/ci.yml"
          />
        </div>

        {/* Docker Recipe */}
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Container className="w-4 h-4 text-green-400" />
            <span>Docker Containerization</span>
          </h3>
          <p className="text-xs text-gray-400">
            Never build secrets into Docker layers or pass plaintext environment variables into container run configs:
          </p>

          <CodeSnippet
            code={`FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Pass KEYZEN_TOKEN at runtime
ENTRYPOINT ["node", "cli/index.mjs", "run", "--", "node", "server.js"]`}
            index={7}
            title="Dockerfile"
          />
        </div>
      </section>

      {/* Configuration Reference */}
      <section className="space-y-4 pt-6 border-t border-[#222222]">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Code2 className="w-5 h-5 text-green-400" />
          <span>Environment Flags Reference</span>
        </h2>

        <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0c0c0c] text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#141414] border-b border-[#222222] text-gray-400 font-mono">
              <tr>
                <th className="p-3">Variable / Flag</th>
                <th className="p-3">Default</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717] text-gray-300 font-mono">
              <tr>
                <td className="p-3 text-green-400">--token / KEYZEN_TOKEN</td>
                <td className="p-3 text-gray-500">~/.keyzen/config.json</td>
                <td className="p-3 text-gray-400 font-sans">The active service token (kzn_...)</td>
              </tr>
              <tr>
                <td className="p-3 text-green-400">--endpoint / KEYZEN_ENDPOINT</td>
                <td className="p-3 text-gray-500">http://localhost:3000</td>
                <td className="p-3 text-gray-400 font-sans">Keyzen Cloud or self-hosted API host URL</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
