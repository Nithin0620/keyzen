'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
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
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  GET_PROJECT_DETAILS,
  CREATE_SECRET,
  DELETE_SECRET,
  REVEAL_SECRET,
  CREATE_SERVICE_TOKEN,
  REVOKE_SERVICE_TOKEN,
} from '@/lib/graphql-operations';

interface ProjectEnvironment {
  id: string;
  name: string;
  slug: string;
  secretCount: number;
}

interface SecretMetadata {
  id: string;
  projectId: string;
  name: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  hasValueInEnvs: string[];
}

interface ServiceTokenSummary {
  id: string;
  name: string;
  environmentId: string;
  environmentName: string;
  tokenPrefix: string;
  createdBy: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

interface OrgMember {
  id: string;
  userId: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  actorType: string;
  actorId: string;
  actorName?: string;
  action: string;
  metadata?: string;
  ipAddress?: string;
  createdAt: string;
}

interface ProjectDetailsResponse {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    members: OrgMember[];
  }>;
  project: {
    id: string;
    orgId: string;
    name: string;
    slug: string;
    description?: string;
    createdAt: string;
    environments: ProjectEnvironment[];
    secrets: SecretMetadata[];
    serviceTokens: ServiceTokenSummary[];
  } | null;
  auditLogs: AuditLogEntry[];
}

export default function ProjectSecretsPage({ params }: { params: { projectSlug: string } }) {
  const [activeTab, setActiveTab] = useState<'secrets' | 'tokens' | 'audit' | 'team'>('secrets');
  const [activeEnv, setActiveEnv] = useState<string>('prod');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [showAddSecretModal, setShowAddSecretModal] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [newGeneratedToken, setNewGeneratedToken] = useState<string | null>(null);

  // Form states
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretComment, setNewSecretComment] = useState('');
  const [newTokenName, setNewTokenName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Decrypted revealed secrets cache: { [secretName_env]: decryptedPlaintext }
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingSecret, setRevealingSecret] = useState<string | null>(null);

  // Fetch live project data
  const { data, loading, error, refetch } = useQuery<ProjectDetailsResponse>(GET_PROJECT_DETAILS, {
    variables: { projectSlug: params.projectSlug },
    fetchPolicy: 'cache-and-network',
    onCompleted: (res) => {
      // Set active environment if not set
      if (res.project?.environments?.length) {
        const hasCurrent = res.project.environments.some((e) => e.slug === activeEnv);
        if (!hasCurrent) {
          setActiveEnv(res.project.environments[0].slug);
        }
      }
    },
  });

  // Lazy query for decrypting secret
  const [revealSecretQuery] = useLazyQuery(REVEAL_SECRET, {
    fetchPolicy: 'no-cache',
  });

  // Mutations
  const [createSecretMutation, { loading: creatingSecret }] = useMutation(CREATE_SECRET, {
    refetchQueries: [{ query: GET_PROJECT_DETAILS, variables: { projectSlug: params.projectSlug } }],
    onCompleted: () => {
      setShowAddSecretModal(false);
      setNewSecretName('');
      setNewSecretValue('');
      setNewSecretComment('');
      setModalError(null);
    },
    onError: (err) => setModalError(err.message),
  });

  const [deleteSecretMutation] = useMutation(DELETE_SECRET, {
    refetchQueries: [{ query: GET_PROJECT_DETAILS, variables: { projectSlug: params.projectSlug } }],
  });

  const [createServiceTokenMutation, { loading: creatingToken }] = useMutation(CREATE_SERVICE_TOKEN, {
    refetchQueries: [{ query: GET_PROJECT_DETAILS, variables: { projectSlug: params.projectSlug } }],
    onCompleted: (res) => {
      setNewGeneratedToken(res.createServiceToken.token);
      setModalError(null);
    },
    onError: (err) => setModalError(err.message),
  });

  const [revokeServiceTokenMutation] = useMutation(REVOKE_SERVICE_TOKEN, {
    refetchQueries: [{ query: GET_PROJECT_DETAILS, variables: { projectSlug: params.projectSlug } }],
  });

  const project = data?.project;
  const environments = project?.environments || [];
  const secrets = project?.secrets || [];
  const tokens = project?.serviceTokens || [];
  const auditLogs = data?.auditLogs || [];
  const org = data?.organizations?.[0];
  const members = org?.members || [];

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleReveal = async (secretName: string) => {
    if (!project) return;
    const cacheKey = `${secretName}_${activeEnv}`;

    if (revealedSecrets[cacheKey] !== undefined) {
      // Toggle off
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      return;
    }

    setRevealingSecret(secretName);
    try {
      const res = await revealSecretQuery({
        variables: {
          projectId: project.id,
          environmentSlug: activeEnv,
          secretName,
        },
      });

      if (res.data?.revealSecret?.value) {
        setRevealedSecrets((prev) => ({
          ...prev,
          [cacheKey]: res.data.revealSecret.value,
        }));
      }
    } catch (err: unknown) {
      alert(`Failed to decrypt secret: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRevealingSecret(null);
    }
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!newSecretName.trim() || !newSecretValue.trim()) {
      setModalError('Secret name and value are required');
      return;
    }

    await createSecretMutation({
      variables: {
        input: {
          projectId: project.id,
          name: newSecretName.trim().toUpperCase(),
          comment: newSecretComment.trim() || undefined,
          values: [
            {
              environmentSlug: activeEnv,
              value: newSecretValue.trim(),
            },
          ],
        },
      },
    });
  };

  const handleDeleteSecret = async (secretName: string) => {
    if (!project) return;
    if (!confirm(`Are you sure you want to permanently delete secret "${secretName}"?`)) return;

    await deleteSecretMutation({
      variables: {
        projectId: project.id,
        secretName,
      },
    });
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!newTokenName.trim()) {
      setModalError('Token name is required');
      return;
    }

    await createServiceTokenMutation({
      variables: {
        input: {
          projectId: project.id,
          environmentSlug: activeEnv,
          name: newTokenName.trim(),
        },
      },
    });
  };

  const handleRevokeToken = async (tokenId: string, tokenName: string) => {
    if (!confirm(`Are you sure you want to revoke service token "${tokenName}"? Any deployment or CLI using it will lose access.`)) return;

    await revokeServiceTokenMutation({
      variables: { tokenId },
    });
  };

  // Filter secrets by search query
  const filteredSecrets = secrets.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.comment && s.comment.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading && !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 text-accent animate-spin" />
        <p className="text-sm font-mono text-muted">Connecting to PostgreSQL & loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Projects
        </Link>
        <div className="p-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 space-y-3">
          <AlertCircle className="h-6 w-6" />
          <h2 className="text-base font-semibold text-white">Project Not Found</h2>
          <p className="text-xs text-muted max-w-md">
            Could not locate project &quot;{params.projectSlug}&quot; in your organization. {error ? error.message : ''}
          </p>
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-lg bg-surface-100 border border-border text-xs text-white hover:bg-surface-50"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Breadcrumb */}
      <div className="space-y-4 border-b border-border pb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Projects
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{project.name}</h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-surface-100 border border-border text-muted">
                /{project.slug}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent">
                <Shield className="h-3 w-3" />
                Live AES-256-GCM
              </span>
            </div>
            <p className="text-sm text-muted mt-1">{project.description || 'Secure environment secrets'}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-border bg-surface-100 text-muted hover:text-white transition-colors"
              title="Refresh project data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {activeTab === 'secrets' && (
              <button
                onClick={() => {
                  setShowAddSecretModal(true);
                  setModalError(null);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm glow-green-sm"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Add Secret ({activeEnv.toUpperCase()})
              </button>
            )}
            {activeTab === 'tokens' && (
              <button
                onClick={() => {
                  setShowAddTokenModal(true);
                  setNewGeneratedToken(null);
                  setModalError(null);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm glow-green-sm"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Generate Service Token
              </button>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-6 pt-2 text-sm">
          <button
            onClick={() => setActiveTab('secrets')}
            className={`pb-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'secrets'
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Lock className="h-4 w-4" />
            Secrets
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-surface-100 border border-border text-muted">
              {secrets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tokens')}
            className={`pb-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'tokens'
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Key className="h-4 w-4" />
            Service Tokens
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-surface-100 border border-border text-muted">
              {tokens.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            Audit Logs
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`pb-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'team'
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Team & RBAC
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-surface-100 border border-border text-muted">
              {members.length}
            </span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: SECRETS ────────────────────────────────────────────────────────── */}
      {activeTab === 'secrets' && (
        <div className="space-y-6">
          {/* Controls: Environment Picker + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Environment Tabs */}
            <div className="flex items-center gap-1.5 bg-surface-200 border border-border p-1 rounded-lg">
              {environments.map((env) => (
                <button
                  key={env.id}
                  onClick={() => setActiveEnv(env.slug)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase transition-all flex items-center gap-1.5 ${
                    activeEnv === env.slug
                      ? 'bg-accent text-black font-semibold shadow-sm'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  <span>{env.slug}</span>
                  <span className={`text-[10px] px-1 rounded ${activeEnv === env.slug ? 'bg-black/20 text-black' : 'bg-surface-100 text-muted'}`}>
                    {env.secretCount}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Filter secrets in this env…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-surface-200 border border-border rounded-lg text-xs text-white placeholder-muted focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          {/* Secrets Table */}
          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-300 flex items-center justify-between text-xs font-mono text-muted">
              <span>KEY / VARIABLE</span>
              <div className="flex items-center gap-8">
                <span>ENCRYPTED VALUE</span>
                <span className="w-24 text-right">ACTIONS</span>
              </div>
            </div>

            {filteredSecrets.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Lock className="h-8 w-8 text-muted mx-auto" />
                <h3 className="text-sm font-semibold text-white">No Secrets in {activeEnv.toUpperCase()}</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Add encrypted API keys, tokens, or environment credentials for your services.
                </p>
                <button
                  onClick={() => setShowAddSecretModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
                >
                  Add Secret
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredSecrets.map((secret) => {
                  const cacheKey = `${secret.name}_${activeEnv}`;
                  const isRevealed = revealedSecrets[cacheKey] !== undefined;
                  const decryptedVal = revealedSecrets[cacheKey] || '';
                  const hasValueInActiveEnv = secret.hasValueInEnvs.includes(activeEnv);
                  const isRevealing = revealingSecret === secret.name;

                  return (
                    <div
                      key={secret.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-100 transition-colors"
                    >
                      {/* Name & Comments */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-white">
                            {secret.name}
                          </span>
                          {!hasValueInActiveEnv && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                              Missing in {activeEnv}
                            </span>
                          )}
                        </div>
                        {secret.comment && (
                          <p className="text-[11px] text-muted">{secret.comment}</p>
                        )}
                      </div>

                      {/* Value & Actions */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-black border border-border px-3 py-1.5 rounded-lg min-w-[260px] max-w-sm justify-between">
                          <span className="font-mono text-xs text-muted truncate">
                            {isRevealed
                              ? decryptedVal
                              : '••••••••••••••••••••••••••••••••'}
                          </span>
                          <div className="flex items-center gap-1">
                            {hasValueInActiveEnv && (
                              <button
                                onClick={() => handleToggleReveal(secret.name)}
                                disabled={isRevealing}
                                className="p-1 text-muted hover:text-white rounded"
                                title={isRevealed ? 'Hide secret' : 'Reveal plaintext value'}
                              >
                                {isRevealing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                                ) : isRevealed ? (
                                  <EyeOff className="h-3.5 w-3.5 text-accent" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}

                            {isRevealed && (
                              <button
                                onClick={() => copyToClipboard(decryptedVal, secret.id)}
                                className="p-1 text-muted hover:text-white rounded"
                                title="Copy decrypted value"
                              >
                                {copiedKey === secret.id ? (
                                  <Check className="h-3.5 w-3.5 text-accent" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Delete Action */}
                        <button
                          onClick={() => handleDeleteSecret(secret.name)}
                          className="p-1.5 text-muted hover:text-red-400 hover:bg-surface-300 rounded transition-colors"
                          title="Delete secret"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: SERVICE TOKENS ─────────────────────────────────────────────────── */}
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Service Tokens</h2>
              <p className="text-xs text-muted mt-0.5">
                Machine authentication credentials for CI/CD, CLI zero-disk injection, and serverless workers.
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddTokenModal(true);
                setNewGeneratedToken(null);
                setModalError(null);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm"
            >
              <Plus className="h-4 w-4" />
              Generate Token
            </button>
          </div>

          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden divide-y divide-border">
            {tokens.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Key className="h-8 w-8 text-muted mx-auto" />
                <h3 className="text-sm font-semibold text-white">No Service Tokens</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Generate tokens with scoped environment access for zero-disk secret injection.
                </p>
              </div>
            ) : (
              tokens.map((token) => (
                <div
                  key={token.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-100 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{token.name}</span>
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface-100 border border-border text-accent">
                        {token.environmentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted font-mono">
                      <span>Prefix: {token.tokenPrefix}</span>
                      <span>By: {token.createdBy}</span>
                      {token.lastUsedAt && <span>Last used: {token.lastUsedAt}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeToken(token.id, token.name)}
                    className="px-3 py-1 rounded-lg border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-colors self-start sm:self-center"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: AUDIT LOGS ──────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Security & Access Audit Trail</h2>
            <span className="text-xs text-muted font-mono">Live PostgreSQL Audit Log</span>
          </div>

          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden divide-y divide-border">
            {auditLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted">
                No audit logs recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-accent">{log.action}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-muted border border-border">
                        {log.actorType}
                      </span>
                      <span className="text-white">{log.actorName || log.actorId}</span>
                    </div>
                    {log.metadata && (
                      <p className="text-[11px] text-muted">{log.metadata}</p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-muted shrink-0 space-y-0.5">
                    <div>{log.createdAt}</div>
                    {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: TEAM ────────────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Organization Members & RBAC Roles</h2>
            <span className="text-xs text-muted font-mono">{members.length} members</span>
          </div>

          <div className="rounded-xl border border-border bg-surface-200 overflow-hidden divide-y divide-border">
            {members.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">No members found.</div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">{m.name || m.email}</div>
                    <div className="text-[11px] text-muted font-mono">{m.email}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface-100 text-accent border border-border">
                    {m.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD SECRET ──────────────────────────────────────────────────────── */}
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

            {modalError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                ⚠ {modalError}
              </div>
            )}

            <form onSubmit={handleAddSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Key Name</label>
                <input
                  type="text"
                  placeholder="e.g. STRIPE_WEBHOOK_SECRET"
                  value={newSecretName}
                  onChange={(e) => setNewSecretName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Secret Value (Plaintext)</label>
                <textarea
                  placeholder="Paste your credential, API key, or private connection string here"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-accent"
                  required
                />
                <p className="text-[11px] text-muted mt-1">
                  Will be encrypted with AES-256-GCM before writing to PostgreSQL.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Comment / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Production webhook signing secret"
                  value={newSecretComment}
                  onChange={(e) => setNewSecretComment(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-white placeholder-muted focus:outline-none focus:border-accent"
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
                  disabled={creatingSecret}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm disabled:opacity-50"
                >
                  {creatingSecret && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Encrypt & Save Secret
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: GENERATE SERVICE TOKEN ─────────────────────────────────────────── */}
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
                {modalError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                    ⚠ {modalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-muted mb-1">Token Name</label>
                  <input
                    type="text"
                    placeholder="e.g. GitHub Actions Production Deployer"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-white placeholder-muted focus:outline-none focus:border-accent"
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
                    disabled={creatingToken}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-colors glow-green-sm disabled:opacity-50"
                  >
                    {creatingToken && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
