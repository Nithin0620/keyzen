'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FolderKey,
  Plus,
  Terminal,
  ShieldCheck,
  Key,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const [copiedCli, setCopiedCli] = useState(false);

  // Mock initial state for preview & initial launch (with GraphQL real-time bindings)
  const [projects] = useState([
    {
      id: 'proj-1',
      name: 'Workflow App',
      slug: 'workflow',
      description: 'Core microservices, LLM orchestration, and payments backend',
      secretsCount: 14,
      envs: ['dev', 'staging', 'prod'],
      updatedAt: '2 mins ago',
    },
    {
      id: 'proj-2',
      name: 'Mobile Client',
      slug: 'mobile-client',
      description: 'React Native iOS & Android application client configurations',
      secretsCount: 6,
      envs: ['dev', 'prod'],
      updatedAt: '1 hour ago',
    },
    {
      id: 'proj-3',
      name: 'Auth & Billing Gateway',
      slug: 'auth-gateway',
      description: 'Supabase webhooks, Stripe checkout, and OAuth providers',
      secretsCount: 9,
      envs: ['dev', 'staging', 'prod'],
      updatedAt: 'Yesterday',
    },
  ]);

  const copyCliCode = () => {
    navigator.clipboard.writeText('npx keyzen run --project workflow --env prod -- npm start');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Developer Secrets Dashboard
            <span className="flex items-center gap-1.5 text-xs font-normal font-mono px-2.5 py-1 rounded-full bg-surface-100 border border-border text-accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              AES-256-GCM
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Manage environments, zero-disk secrets injection, and RBAC team access across all services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm glow-green-sm">
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Project
          </button>
        </div>
      </div>

      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Total Projects</span>
            <FolderKey className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">{projects.length}</span>
            <span className="text-xs text-muted-foreground ml-2">Active</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Encrypted Secrets</span>
            <Lock className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">29</span>
            <span className="text-xs text-accent ml-2">100% Encrypted</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Service Tokens</span>
            <Key className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">5</span>
            <span className="text-xs text-muted-foreground ml-2">CLI / CI active</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Zero-Disk Injection</span>
            <Terminal className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-accent font-mono">READY</span>
            <span className="text-xs text-muted-foreground ml-2">via @keyzen/cli</span>
          </div>
        </div>
      </div>

      {/* Zero-Disk CLI Banner */}
      <div className="p-5 rounded-xl bg-surface-300 border border-border relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Zero-Disk Secret Injection</span>
            </div>
            <h3 className="text-sm font-semibold text-white">
              Run your application without storing secrets in plain .env files
            </h3>
            <p className="text-xs text-muted">
              Keyzen pulls encrypted secrets into RAM and injects them straight into your process memory.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-black border border-border rounded-lg px-3.5 py-2 font-mono text-xs text-muted-foreground max-w-lg w-full md:w-auto justify-between">
            <span className="text-white truncate">
              <span className="text-accent">$</span> npx keyzen run -- npm start
            </span>
            <button
              onClick={copyCliCode}
              className="p-1.5 hover:text-white rounded hover:bg-surface-100 transition-colors"
              title="Copy command"
            >
              {copiedCli ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Projects</h2>
          <span className="text-xs text-muted-foreground font-mono">{projects.length} configured</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <Link
              key={proj.id}
              href={`/projects/${proj.slug}`}
              className="group p-5 rounded-xl bg-surface-200 border border-border hover:border-accent/40 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-surface-100 border border-border flex items-center justify-center group-hover:border-accent/30 transition-colors">
                      <FolderKey className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
                        {proj.name}
                      </h3>
                      <p className="text-[11px] font-mono text-muted-foreground">/{proj.slug}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </div>

                <p className="text-xs text-muted line-clamp-2">{proj.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-mono">
                  {proj.envs.map((env) => (
                    <span
                      key={env}
                      className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-surface-100 text-muted-foreground border border-border group-hover:border-border/80"
                    >
                      {env}
                    </span>
                  ))}
                </div>
                <span className="text-accent font-mono text-[11px]">
                  {proj.secretsCount} secrets
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
