'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Key,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Lock,
  Search,
  Terminal,
  Activity,
  UserCheck,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  FileCode,
} from 'lucide-react';

interface SecretItem {
  id: string;
  name: string;
  comment?: string;
  value: string;
  revealed?: boolean;
  version: number;
  updatedAt: string;
}

interface ServiceTokenItem {
  id: string;
  name: string;
  prefix: string;
  env: string;
  createdBy: string;
  lastUsedAt?: string;
  createdAt: string;
}

export default function ProjectSecretsPage({ params }: { params: { projectSlug: string } }) {
  const [activeTab, setActiveTab] = useState<'secrets' | 'tokens' | 'audit' | 'team'>('secrets');
  const [activeEnv, setActiveEnv] = useState<'dev' | 'staging' | 'prod'>('prod');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAddSecretModal, setShowAddSecretModal] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [newGeneratedToken, setNewGeneratedToken] = useState<string | null>(null);

  // New Secret form state
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretComment, setNewSecretComment] = useState('');

  // New Token form state
  const [newTokenName, setNewTokenName] = useState('');

  // Initial mock secrets data
  const [secretsList, setSecretsList] = useState<Record<string, SecretItem[]>>({
    prod: [
      { id: '1', name: 'DATABASE_URL', value: 'postgresql://postgres:p_x8712a@aws.supabase.co:5432/keyzen_prod', version: 3, updatedAt: '10 mins ago', comment: 'Supabase Postgres connection pooler' },
      { id: '2', name: 'STRIPE_SECRET_KEY', value: 'sk_test_PLACEHOLDER_0000', version: 1, updatedAt: '1 hour ago', comment: 'Stripe production secret key' },
      { id: '3', name: 'OPENAI_API_KEY', value: 'sk-placeholder-0000', version: 2, updatedAt: 'Yesterday', comment: 'GPT-4o production agent key' },
      { id: '4', name: 'RESEND_API_KEY', value: 're_placeholder_0000', version: 1, updatedAt: '3 days ago', comment: 'Transactional email provider' },
      { id: '5', name: 'JWT_SIGNING_SECRET', value: 'super_secure_jwt_signing_secret_key_2026', version: 4, updatedAt: 'Sep 28, 2026', comment: 'Auth token encryption key' },
    ],
    staging: [
      { id: '6', name: 'DATABASE_URL', value: 'postgresql://postgres:staging_pass@staging.supabase.co:5432/db', version: 1, updatedAt: '2 days ago' },
      { id: '7', name: 'STRIPE_SECRET_KEY', value: 'sk_test_PLACEHOLDER_1111', version: 1, updatedAt: '2 days ago' },
      { id: '8', name: 'OPENAI_API_KEY', value: 'sk-placeholder-1111', version: 1, updatedAt: '2 days ago' },
    ],
    dev: [
      { id: '9', name: 'DATABASE_URL', value: 'postgresql://postgres:postgres@localhost:5432/workflow_dev', version: 1, updatedAt: '1 week ago' },
      { id: '10', name: 'STRIPE_SECRET_KEY', value: 'sk_test_local_dummy_key_1234', version: 1, updatedAt: '1 week ago' },
      { id: '11', name: 'OPENAI_API_KEY', value: 'sk-dummy-dev-openai-key', version: 1, updatedAt: '1 week ago' },
    ],
  });

  // Service Tokens
  const [tokens, setTokens] = useState<ServiceTokenItem[]>([
    { id: 'tok-1', name: 'GitHub Actions Production CI', prefix: 'kzn_prod_a98f12...', env: 'prod', createdBy: 'nithin@keyzen.dev', lastUsedAt: '5 mins ago', createdAt: 'Sep 20, 2026' },
    { id: 'tok-2', name: 'Local Dev CLI - Nithin', prefix: 'kzn_dev_b12c89...', env: 'dev', createdBy: 'nithin@keyzen.dev', lastUsedAt: 'Just now', createdAt: 'Sep 25, 2026' },
    { id: 'tok-3', name: 'Staging Auto-Deployer', prefix: 'kzn_staging_d44e71...', env: 'staging', createdBy: 'rahul@keyzen.dev', lastUsedAt: '2 hours ago', createdAt: 'Sep 28, 2026' },
  ]);

  // Audit Logs
  const [auditLogs] = useState([
    { id: 'log-1', actor: 'Local Dev CLI - Nithin', type: 'SERVICE_TOKEN', action: 'SECRET_RESOLVE_BATCH', env: 'dev', time: 'Just now', ip: '127.0.0.1', details: 'Resolved 3 secrets for CLI runtime' },
    { id: 'log-2', actor: 'nithin@keyzen.dev', type: 'USER', action: 'SECRET_REVEAL', env: 'prod', time: '8 mins ago', ip: '192.168.1.45', details: 'Revealed plaintext for STRIPE_SECRET_KEY' },
    { id: 'log-3', actor: 'GitHub Actions Production CI', type: 'SERVICE_TOKEN', action: 'SECRET_RESOLVE_BATCH', env: 'prod', time: '1 hour ago', ip: '140.82.112.4', details: 'Resolved 5 secrets for deployment build' },
    { id: 'log-4', actor: 'nithin@keyzen.dev', type: 'USER', action: 'SECRET_UPDATE', env: 'prod', time: '1 hour ago', ip: '192.168.1.45', details: 'Updated value for DATABASE_URL (v3)' },
  ]);

  const toggleReveal = (id: string) => {
    setSecretsList((prev) => ({
      ...prev,
      [activeEnv]: prev[activeEnv].map((s) =>
        s.id === id ? { ...s, revealed: !s.revealed } : s
      ),
    }));
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName || !newSecretValue) return;

    const newSecret: SecretItem = {
      id: Math.random().toString(),
      name: newSecretName.toUpperCase().trim(),
      value: newSecretValue,
      comment: newSecretComment.trim() || undefined,
      version: 1,
      updatedAt: 'Just now',
      revealed: false,
    };

    setSecretsList((prev) => ({
      ...prev,
      [activeEnv]: [newSecret, ...prev[activeEnv]],
    }));

    setNewSecretName('');
    setNewSecretValue('');
    setNewSecretComment('');
    setShowAddSecretModal(false);
  };

  const handleDeleteSecret = (id: string) => {
    setSecretsList((prev) => ({
      ...prev,
      [activeEnv]: prev[activeEnv].filter((s) => s.id !== id),
    }));
  };

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName) return;

    const rawToken = `kzn_${activeEnv}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const newToken: ServiceTokenItem = {
      id: Math.random().toString(),
      name: newTokenName,
      prefix: rawToken.slice(0, 16) + '...',
      env: activeEnv,
      createdBy: 'nithin@keyzen.dev',
      lastUsedAt: 'Never',
      createdAt: 'Just now',
    };

    setTokens((prev) => [newToken, ...prev]);
    setNewGeneratedToken(rawToken);
    setNewTokenName('');
  };

  const filteredSecrets = (secretsList[activeEnv] || []).filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.comment && s.comment.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-surface-100 border border-border text-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white capitalize">
                {params.projectSlug.replace('-', ' ')}
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-100 text-muted border border-border">
                /{params.projectSlug}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Envelope encryption active with per-project AES-256-GCM data encryption keys.
            </p>
          </div>
        </div>

        {/* Feature Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-200 border border-border">
          <button
            onClick={() => setActiveTab('secrets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'secrets' ? 'bg-surface-50 text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-accent" />
            Secrets
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'tokens' ? 'bg-surface-50 text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <Key className="h-3.5 w-3.5 text-accent" />
            Service Tokens
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'audit' ? 'bg-surface-50 text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-accent" />
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'team' ? 'bg-surface-50 text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-accent" />
            RBAC Team
          </button>
        </div>
      </div>

      {/* TAB 1: SECRETS MANAGER */}
      {activeTab === 'secrets' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-200 p-3 rounded-xl border border-border">
            {/* Environment Selector */}
            <div className="flex items-center gap-1.5">
              {(['prod', 'staging', 'dev'] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => setActiveEnv(env)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    activeEnv === env
                      ? 'bg-accent text-black font-semibold shadow-sm'
                      : 'bg-surface-100 text-muted border border-border hover:text-white hover:border-border/80'
                  }`}
                >
                  {env.toUpperCase()}
                  <span className="ml-1.5 text-[10px] opacity-80">
                    ({secretsList[env]?.length || 0})
                  </span>
                </button>
              ))}
            </div>

            {/* Search & Add */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search keys or comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-black border border-border rounded-lg text-xs text-white placeholder-muted-dark focus:outline-none focus:border-accent w-48 sm:w-64"
                />
              </div>

              <button
                onClick={() => setShowAddSecretModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                Add Secret
              </button>
            </div>
          </div>

          {/* Secrets Table */}
          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-surface-100 border-b border-border text-[11px] font-mono text-muted uppercase tracking-wider">
              <div className="col-span-4">Key Name</div>
              <div className="col-span-5">Value (AES-256 Encrypted)</div>
              <div className="col-span-1 text-center">Ver</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-border/60">
              {filteredSecrets.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted font-mono">
                  No secrets found in {activeEnv.toUpperCase()} environment.
                </div>
              ) : (
                filteredSecrets.map((secret) => (
                  <div
                    key={secret.id}
                    className="grid grid-cols-12 px-4 py-3 items-center hover:bg-surface-100/50 transition-colors text-xs"
                  >
                    {/* Key Name & Comment */}
                    <div className="col-span-4 space-y-0.5 pr-2">
                      <div className="font-mono font-semibold text-white flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-accent shrink-0" />
                        <span className="truncate">{secret.name}</span>
                      </div>
                      {secret.comment && (
                        <p className="text-[11px] text-muted truncate">{secret.comment}</p>
                      )}
                    </div>

                    {/* Value */}
                    <div className="col-span-5 pr-2">
                      <div className="font-mono bg-black/80 border border-border px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs">
                        <span className="truncate text-muted-foreground select-all">
                          {secret.revealed ? (
                            <span className="text-accent font-medium">{secret.value}</span>
                          ) : (
                            '••••••••••••••••••••••••••••••••'
                          )}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            onClick={() => toggleReveal(secret.id)}
                            className="p-1 hover:text-white text-muted transition-colors rounded"
                            title={secret.revealed ? 'Hide value' : 'Reveal decrypted value'}
                          >
                            {secret.revealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(secret.value, secret.id)}
                            className="p-1 hover:text-white text-muted transition-colors rounded"
                            title="Copy plaintext to clipboard"
                          >
                            {copiedKey === secret.id ? (
                              <Check className="h-3.5 w-3.5 text-accent" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Version Badge */}
                    <div className="col-span-1 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-100 border border-border text-muted">
                        v{secret.version}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-2 text-right">
                      <button
                        onClick={() => handleDeleteSecret(secret.id)}
                        className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete secret"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE TOKENS */}
      {activeTab === 'tokens' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface-200 p-4 rounded-xl border border-border">
            <div>
              <h2 className="text-sm font-semibold text-white">Service Tokens</h2>
              <p className="text-xs text-muted mt-0.5">
                Scoped authentication tokens for GitHub Actions, CI/CD runners, and developers CLI sessions.
              </p>
            </div>
            <button
              onClick={() => {
                setNewGeneratedToken(null);
                setShowAddTokenModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              Generate Token
            </button>
          </div>

          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden divide-y divide-border/60">
            {tokens.map((token) => (
              <div key={token.id} className="p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{token.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-medium bg-accent/10 text-accent border border-accent/20">
                      {token.env}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted font-mono">
                    <span>{token.prefix}</span>
                    <span>•</span>
                    <span>Created by {token.createdBy}</span>
                    <span>•</span>
                    <span>Last used: {token.lastUsedAt}</span>
                  </div>
                </div>

                <button
                  onClick={() => setTokens(tokens.filter((t) => t.id !== token.id))}
                  className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-md transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-surface-200 p-4 rounded-xl border border-border">
            <h2 className="text-sm font-semibold text-white">Cryptographic Audit Trail</h2>
            <p className="text-xs text-muted mt-0.5">
              Append-only audit logs recording every secret resolution, reveal, and token operation.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden divide-y divide-border/60">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-100/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent font-semibold">{log.action}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-surface-100 text-muted border border-border">
                      {log.env}
                    </span>
                    <span className="text-xs text-white">{log.actor}</span>
                  </div>
                  <p className="text-xs text-muted font-mono">{log.details}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <span>IP: {log.ip}</span>
                  <span>•</span>
                  <span>{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RBAC TEAM */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface-200 p-4 rounded-xl border border-border">
            <div>
              <h2 className="text-sm font-semibold text-white">Project Members & Access Control</h2>
              <p className="text-xs text-muted mt-0.5">
                Manage roles and environment decrypt permissions for teammates.
              </p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm">
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              Invite Member
            </button>
          </div>

          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden divide-y divide-border/60 text-xs">
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Nithin (You)</div>
                <div className="text-muted font-mono">nithin@keyzen.dev</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-accent/10 text-accent border border-accent/20">
                Owner
              </span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Rahul Sharma</div>
                <div className="text-muted font-mono">rahul@keyzen.dev</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface-100 text-muted border border-border">
                Developer (Dev + Staging)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD SECRET */}
      {showAddSecretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-200 border border-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                Add Secret ({activeEnv.toUpperCase()})
              </h3>
              <button
                onClick={() => setShowAddSecretModal(false)}
                className="text-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Key Name</label>
                <input
                  type="text"
                  placeholder="e.g. STRIPE_WEBHOOK_SECRET"
                  value={newSecretName}
                  onChange={(e) => setNewSecretName(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs font-mono text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Secret Value (Plaintext)</label>
                <textarea
                  placeholder="Paste your API key, connection string, or credential here"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs font-mono text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                  required
                />
                <p className="text-[11px] text-muted mt-1">
                  Will be encrypted with AES-256-GCM before saving to Supabase.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Comment / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Production webhook signing secret"
                  value={newSecretComment}
                  onChange={(e) => setNewSecretComment(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSecretModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
                >
                  Encrypt & Save Secret
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE TOKEN */}
      {showAddTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-200 border border-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-accent" />
                Generate Service Token ({activeEnv.toUpperCase()})
              </h3>
              <button
                onClick={() => setShowAddTokenModal(false)}
                className="text-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            {newGeneratedToken ? (
              <div className="space-y-4">
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent">
                  ⚠ <strong>Important:</strong> Copy your service token now. It will never be shown again!
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Your Keyzen Service Token</label>
                  <div className="flex items-center gap-2 bg-black border border-border rounded-lg p-2.5">
                    <span className="font-mono text-xs text-white truncate">{newGeneratedToken}</span>
                    <button
                      onClick={() => copyToClipboard(newGeneratedToken, 'modal-token')}
                      className="p-1 text-muted hover:text-white rounded"
                    >
                      {copiedKey === 'modal-token' ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowAddTokenModal(false)}
                    className="px-4 py-1.5 rounded-lg bg-surface-100 border border-border text-xs text-white hover:bg-surface-50"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Token Name</label>
                  <input
                    type="text"
                    placeholder="e.g. GitHub Actions Production Deployer"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTokenModal(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
                  >
                    Generate Token
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
