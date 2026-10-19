'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import {
  FolderKey,
  Plus,
  Terminal,
  ShieldCheck,
  Key,
  Copy,
  Check,
  ChevronRight,
  Lock,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { GET_DASHBOARD_DATA, CREATE_PROJECT } from '@/lib/graphql-operations';

interface ProjectEnvironment {
  id: string;
  name: string;
  slug: string;
  secretCount: number;
}

interface ProjectData {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  environments: ProjectEnvironment[];
}

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  projects: ProjectData[];
}

export default function DashboardOverviewPage() {
  const [copiedCli, setCopiedCli] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<{ organizations: OrganizationData[] }>(
    GET_DASHBOARD_DATA,
    { fetchPolicy: 'cache-and-network' }
  );

  const [createProjectMutation, { loading: creatingProject }] = useMutation(CREATE_PROJECT, {
    refetchQueries: [{ query: GET_DASHBOARD_DATA }],
    onCompleted: () => {
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectSlug('');
      setNewProjectDesc('');
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

  const organizations = data?.organizations || [];
  const currentOrg = organizations[0];
  const projects = currentOrg?.projects || [];

  // Compute live metrics across all active projects
  const totalSecrets = projects.reduce((acc, p) => {
    const maxSecretsInEnv = Math.max(...p.environments.map((e) => e.secretCount), 0);
    return acc + maxSecretsInEnv;
  }, 0);

  const copyCliCode = () => {
    navigator.clipboard.writeText('npx keyzen run -- npm start');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleNameChange = (name: string) => {
    setNewProjectName(name);
    // Auto-generate slug
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setNewProjectSlug(generatedSlug);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) {
      setFormError('No organization found. Please verify your account.');
      return;
    }
    if (!newProjectName.trim() || !newProjectSlug.trim()) {
      setFormError('Project name and slug are required.');
      return;
    }

    try {
      await createProjectMutation({
        variables: {
          orgId: currentOrg.id,
          name: newProjectName.trim(),
          slug: newProjectSlug.trim(),
          description: newProjectDesc.trim() || undefined,
        },
      });
    } catch {
      // Handled in onError
    }
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
              AES-256-GCM Live DB
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {currentOrg ? (
              <>
                Organization:{' '}
                <span className="font-semibold text-white">{currentOrg.name}</span>{' '}
                <span className="font-mono text-muted text-xs">({currentOrg.slug})</span>
              </>
            ) : (
              'Manage environments, zero-disk secrets injection, and RBAC team access across all services.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-100 text-xs text-muted hover:text-white transition-colors"
            title="Refresh live data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!currentOrg}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm glow-green-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Project
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load projects from backend: {error.message}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="underline hover:text-red-300 font-medium ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Total Projects</span>
            <FolderKey className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">
              {loading ? '…' : projects.length}
            </span>
            <span className="text-xs text-muted ml-2">Active in Org</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Encrypted Secrets</span>
            <Lock className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">
              {loading ? '…' : totalSecrets}
            </span>
            <span className="text-xs text-accent ml-2">PostgreSQL Live</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Active Environments</span>
            <Key className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">
              {loading
                ? '…'
                : projects.reduce((acc, p) => acc + p.environments.length, 0)}
            </span>
            <span className="text-xs text-muted ml-2">Dev / Stage / Prod</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-200 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Zero-Disk Injection</span>
            <Terminal className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-accent font-mono">LIVE</span>
            <span className="text-xs text-muted ml-2">via @keyzen/cli</span>
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
              Keyzen pulls encrypted secrets from PostgreSQL into RAM and injects them straight into your process memory.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-black border border-border rounded-lg px-3.5 py-2 font-mono text-xs text-muted max-w-lg w-full md:w-auto justify-between">
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
          <span className="text-xs text-muted font-mono">{projects.length} configured</span>
        </div>

        {loading && projects.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-surface-200 border border-border animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-5 w-32 bg-surface-100 rounded" />
                  <div className="h-3 w-48 bg-surface-100 rounded" />
                </div>
                <div className="h-4 w-20 bg-surface-100 rounded" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 rounded-xl bg-surface-200 border border-border text-center space-y-3">
            <FolderKey className="h-8 w-8 text-muted mx-auto" />
            <h3 className="text-sm font-semibold text-white">No Projects Yet</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Create your first project to start storing encrypted credentials and configuring environments.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const projectTotalSecrets = proj.environments.reduce(
                (sum, env) => sum + env.secretCount,
                0
              );

              return (
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
                          <p className="text-[11px] font-mono text-muted">/{proj.slug}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <p className="text-xs text-muted line-clamp-2">
                      {proj.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-mono">
                      {proj.environments.map((env) => (
                        <span
                          key={env.id}
                          className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-surface-100 text-muted border border-border group-hover:border-border/80"
                        >
                          {env.slug}
                        </span>
                      ))}
                    </div>
                    <span className="text-accent font-mono text-[11px]">
                      {projectTotalSecrets} values
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface-200 border border-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <FolderKey className="h-4 w-4 text-accent" />
                Create New Project
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                ⚠ {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Payment Gateway"
                  value={newProjectName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Project Slug (URL & CLI identifier)</label>
                <input
                  type="text"
                  placeholder="e.g. payment-gateway"
                  value={newProjectSlug}
                  onChange={(e) => setNewProjectSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs font-mono text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Description (Optional)</label>
                <textarea
                  placeholder="e.g. Stripe checkout, invoice generation and webhook handlers"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                />
              </div>

              <div className="p-3 bg-surface-100 border border-border rounded-lg text-[11px] text-muted space-y-1 font-mono">
                <p>⚡ Automatically creates default environments:</p>
                <div className="flex gap-2 pt-1">
                  <span className="px-1.5 py-0.5 rounded bg-surface-200 border border-border text-white">dev</span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-200 border border-border text-white">staging</span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-200 border border-border text-white">prod</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm disabled:opacity-50"
                >
                  {creatingProject && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
