'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Check,
  Shield,
  Loader2,
  AlertCircle,
  Terminal,
  Key,
  Upload,
  Download,
  History,
  Activity,
  Webhook,
  Users,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface SecretItem {
  id: string;
  name: string;
  comment?: string;
  value: string;
  version: number;
}

interface ServiceTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  environmentSlug: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface AuditLogItem {
  id: string;
  actorType: string;
  actorName: string;
  action: string;
  metadata?: any;
  ipAddress?: string;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  url: string;
  platform: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

interface TeamMemberItem {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

interface VersionItem {
  id: string;
  version: number;
  value: string;
  changedBy: string;
  createdAt: string;
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'vault' | 'audit' | 'webhooks' | 'team'>('vault');
  const [activeEnv, setActiveEnv] = useState<'dev' | 'staging' | 'prod'>('dev');

  // Vault data
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [tokens, setTokens] = useState<ServiceTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab data
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [members, setMembers] = useState<TeamMemberItem[]>([]);

  // Secret visibility toggle map
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});

  // Add / Edit Secret Modal
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretComment, setSecretComment] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);

  // Bulk Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Generate Token Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenName, setTokenName] = useState('Local Dev');
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedPlaintextToken, setGeneratedPlaintextToken] = useState<string | null>(null);

  // Version History Modal
  const [historySecret, setHistorySecret] = useState<SecretItem | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // Webhook Modal
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  // Team Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchSecrets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/secrets?projectId=${projectId}&environment=${activeEnv}`);
      if (!res.ok) throw new Error('Failed to load secrets');
      const data = await res.json();
      setSecrets(data.secrets || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTokens = async () => {
    try {
      const res = await fetch(`/api/tokens?projectId=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch {}
  };

  const fetchAudit = async () => {
    try {
      const res = await fetch(`/api/audit?projectId=${projectId}`);
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch {}
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`/api/webhooks?projectId=${projectId}`);
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch {}
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/team?projectId=${projectId}`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch {}
  };

  useEffect(() => {
    let active = true;
    Promise.all([fetchSecrets(), fetchTokens()]);
    if (activeTab === 'audit') fetchAudit();
    if (activeTab === 'webhooks') fetchWebhooks();
    if (activeTab === 'team') fetchTeam();
    return () => {
      active = false;
    };
  }, [projectId, activeEnv, activeTab]);

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim() || secretValue === undefined) return;

    try {
      setSavingSecret(true);
      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          environmentSlug: activeEnv,
          name: secretKey.trim().toUpperCase(),
          value: secretValue,
          comment: secretComment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save secret');
      }

      setSecretKey('');
      setSecretValue('');
      setSecretComment('');
      setShowSecretModal(false);
      await fetchSecrets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSecret(false);
    }
  };

  const handleImportEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;

    try {
      setImporting(true);
      const res = await fetch('/api/secrets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          environmentSlug: activeEnv,
          rawEnv: importText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import secrets');

      alert(`Successfully imported ${data.count} secrets into ${activeEnv.toUpperCase()}!`);
      setImportText('');
      setShowImportModal(false);
      await fetchSecrets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleExportEnv = () => {
    if (secrets.length === 0) return alert('No secrets available to export in this environment.');

    const envLines = secrets.map((s) => {
      const comment = s.comment ? `# ${s.comment}\n` : '';
      return `${comment}${s.name}=${s.value}`;
    });

    const fileContent = envLines.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `.env.${activeEnv}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openHistoryModal = async (secret: SecretItem) => {
    setHistorySecret(secret);
    setVersions([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/secrets/history?secretId=${secret.id}&projectId=${projectId}&environment=${activeEnv}`
      );
      const data = await res.json();
      setVersions(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRollback = async (historyId: string, version: number) => {
    if (!historySecret) return;
    if (!confirm(`Are you sure you want to rollback ${historySecret.name} to version ${version}?`)) return;

    try {
      setRollingBack(true);
      const res = await fetch('/api/secrets/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyId,
          secretId: historySecret.id,
          projectId,
          environmentSlug: activeEnv,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to rollback');
      }

      alert(`Rolled back ${historySecret.name} to version ${version}`);
      setHistorySecret(null);
      await fetchSecrets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRollingBack(false);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    try {
      setCreatingWebhook(true);
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, url: webhookUrl.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create webhook');
      setWebhookUrl('');
      setShowWebhookModal(false);
      await fetchWebhooks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' });
    await fetchWebhooks();
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      });
      if (!res.ok) throw new Error('Failed to invite member');
      setInviteEmail('');
      setInviteName('');
      setShowInviteModal(false);
      await fetchTeam();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!confirm('Remove this member?')) return;
    await fetch(`/api/team?memberId=${id}`, { method: 'DELETE' });
    await fetchTeam();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-3 font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Secrets Vault
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1">Project ID: {projectId}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportEnv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2e2e2e] text-xs text-gray-300 font-mono transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .env</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2e2e2e] text-xs text-gray-300 font-mono transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-green-400" />
              <span>Import .env</span>
            </button>
            <button
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2e2e2e] text-xs text-gray-300 font-medium transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-green-400" />
              <span>Tokens</span>
            </button>
            <button
              onClick={() => setShowSecretModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Secret</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main SaaS Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#222222]">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('vault')}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === 'vault'
                ? 'border-green-400 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-green-400" />
            <span>Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === 'audit'
                ? 'border-green-400 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === 'webhooks'
                ? 'border-green-400 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Webhook className="w-3.5 h-3.5 text-green-400" />
            <span>Webhooks & Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 -mb-px ${
              activeTab === 'team'
                ? 'border-green-400 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-green-400" />
            <span>Team & RBAC</span>
          </button>
        </div>

        <Link
          href="/dashboard/billing"
          className="pb-3 text-xs font-mono text-gray-400 hover:text-green-400 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-green-400" />
          <span>Plans & Usage</span>
        </Link>
      </div>

      {/* TAB 1: VAULT */}
      {activeTab === 'vault' && (
        <div className="space-y-6">
          {/* Environment Selector Tabs */}
          <div className="flex items-center gap-2">
            {(['dev', 'staging', 'prod'] as const).map((env) => (
              <button
                key={env}
                onClick={() => setActiveEnv(env)}
                className={`px-4 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  activeEnv === env
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#141414] border border-transparent'
                }`}
              >
                {env.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Secrets Table */}
          <div className="bg-[#0b0b0b] border border-[#222222] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#1c1c1c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-white">
                  Environment Variables ({secrets.length})
                </span>
              </div>
              <span className="text-xs font-mono text-gray-500">AES-256-GCM Encrypted</span>
            </div>

            {loading && (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                <span className="text-xs font-mono">Loading secrets...</span>
              </div>
            )}

            {!loading && !error && secrets.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <p className="text-sm">No secrets found in {activeEnv.toUpperCase()} environment.</p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3 py-1.5 rounded bg-[#161616] border border-[#282828] text-gray-300 text-xs font-mono hover:bg-[#202020] transition-colors"
                  >
                    Import .env
                  </button>
                  <button
                    onClick={() => setShowSecretModal(true)}
                    className="px-3 py-1.5 rounded bg-green-500 text-black text-xs font-semibold hover:bg-green-400 transition-colors"
                  >
                    + Add Secret
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && secrets.length > 0 && (
              <div className="divide-y divide-[#171717]">
                {secrets.map((secret) => {
                  const isVisible = visibleMap[secret.id] || false;
                  return (
                    <div
                      key={secret.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#111111] transition-colors"
                    >
                      <div className="space-y-1 max-w-sm">
                        <div className="font-mono text-sm font-bold text-white tracking-wide flex items-center gap-2">
                          <span>{secret.name}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-[#161616] border border-[#252525] px-1.5 py-0.5 rounded">
                            v{secret.version}
                          </span>
                        </div>
                        {secret.comment && (
                          <div className="text-xs text-gray-500">{secret.comment}</div>
                        )}
                      </div>

                      <div className="flex-1 max-w-md">
                        <div className="font-mono text-xs bg-[#141414] border border-[#222222] px-3 py-2 rounded-lg text-gray-300 truncate">
                          {isVisible ? (
                            secret.value || <span className="text-gray-600 italic">Empty</span>
                          ) : (
                            <span className="tracking-widest text-gray-500">••••••••••••••••••••</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => openHistoryModal(secret)}
                          title="Version History & Rollback"
                          className="p-1.5 rounded hover:bg-[#202020] text-gray-400 hover:text-white transition-colors"
                        >
                          <History className="w-4 h-4 text-green-400" />
                        </button>

                        <button
                          onClick={() =>
                            setVisibleMap((prev) => ({ ...prev, [secret.id]: !isVisible }))
                          }
                          title={isVisible ? 'Hide' : 'Reveal'}
                          className="p-1.5 rounded hover:bg-[#202020] text-gray-400 hover:text-white transition-colors"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => copyToClipboard(secret.value, secret.id)}
                          title="Copy Secret"
                          className="p-1.5 rounded hover:bg-[#202020] text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedKey === secret.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={async () => {
                            if (!confirm(`Delete ${secret.name}?`)) return;
                            await fetch(`/api/secrets?secretId=${secret.id}`, { method: 'DELETE' });
                            await fetchSecrets();
                          }}
                          title="Delete Secret"
                          className="p-1.5 rounded hover:bg-[#202020] text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Service Tokens Card */}
          <div className="bg-[#0b0b0b] border border-[#222222] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-green-400" />
                  Service Tokens
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Used by Keyzen CLI for zero-disk secret injection.
                </p>
              </div>
              <button
                onClick={() => setShowTokenModal(true)}
                className="text-xs font-mono text-green-400 hover:underline"
              >
                + Create New Token
              </button>
            </div>

            {tokens.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No service tokens created for this project.</p>
            ) : (
              <div className="divide-y divide-[#171717]">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="py-3 flex items-center justify-between gap-4 text-xs font-mono"
                  >
                    <div>
                      <span className="text-white font-medium">{token.name}</span>
                      <span className="text-gray-500 ml-2">({token.environmentSlug})</span>
                      <div className="text-gray-600 text-[11px] mt-0.5">{token.tokenPrefix}</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Revoke token?')) return;
                        await fetch(`/api/tokens?id=${token.id}`, { method: 'DELETE' });
                        await fetchTokens();
                      }}
                      className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-[#0b0b0b] border border-[#222222] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1c1c1c] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-white">Security Audit Log</span>
            </div>
            <button onClick={fetchAudit} className="text-xs font-mono text-gray-400 hover:text-white">
              Refresh
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-xs font-mono">
              No audit events recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#171717]">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-bold">{log.action}</span>
                      <span className="text-gray-500">&bull;</span>
                      <span className="text-gray-300">{log.actorName || log.actorType}</span>
                    </div>
                    {log.metadata && (
                      <div className="text-[11px] text-gray-500 font-sans">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-gray-500 space-y-0.5">
                    <div>{new Date(log.createdAt).toLocaleString()}</div>
                    {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div className="bg-[#0b0b0b] border border-[#222222] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-green-400" />
                Security Webhooks & Alerts
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Send live alerts to Slack or Discord whenever secrets are modified or revoked.
              </p>
            </div>
            <button
              onClick={() => setShowWebhookModal(true)}
              className="px-3 py-1.5 rounded-lg bg-green-500 text-black font-semibold text-xs hover:bg-green-400 transition-colors"
            >
              + Add Webhook
            </button>
          </div>

          {webhooks.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              No webhooks configured. Add your Slack or Discord incoming webhook URL above.
            </div>
          ) : (
            <div className="divide-y divide-[#171717]">
              {webhooks.map((wh) => (
                <div key={wh.id} className="py-3 flex items-center justify-between gap-4 text-xs font-mono">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{wh.platform}</span>
                      <span className="text-green-400 text-[10px] bg-green-500/10 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                    <div className="text-gray-500 text-[11px] truncate max-w-md">{wh.url}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TEAM RBAC */}
      {activeTab === 'team' && (
        <div className="bg-[#0b0b0b] border border-[#222222] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400" />
                Team Members & Roles
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Manage workspace permissions with Role-Based Access Control (RBAC).
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 py-1.5 rounded-lg bg-green-500 text-black font-semibold text-xs hover:bg-green-400 transition-colors"
            >
              + Invite Member
            </button>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">No team members invited yet.</div>
          ) : (
            <div className="divide-y divide-[#171717]">
              {members.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="text-white font-medium">{m.email}</div>
                    {m.name && <div className="text-gray-500 text-[11px]">{m.name}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#161616] border border-[#2b2b2b] text-green-400 font-bold">
                      {m.role}
                    </span>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Import .env */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-green-400" />
              <span>Bulk Import .env ({activeEnv.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-gray-400">
              Paste raw .env contents below. Keyzen will encrypt each key with AES-256-GCM.
            </p>

            <form onSubmit={handleImportEnv} className="space-y-4">
              <textarea
                required
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`DATABASE_URL=postgresql://...\nSTRIPE_KEY=sk_test_...\nOPENAI_KEY=sk-proj-...`}
                rows={8}
                className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg p-3 text-xs text-green-400 font-mono focus:outline-none focus:border-green-500"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#222222] text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs flex items-center gap-2"
                >
                  {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{importing ? 'Encrypting & Importing...' : 'Import All'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Secret Version History & Rollback */}
      {historySecret && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-green-400" />
                  <span>Version History: {historySecret.name}</span>
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Current Version: v{historySecret.version} ({activeEnv.toUpperCase()})
                </p>
              </div>
              <button
                onClick={() => setHistorySecret(null)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {loadingHistory && (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-green-400" />
              </div>
            )}

            {!loadingHistory && versions.length === 0 && (
              <p className="text-xs text-gray-500 py-6 text-center">
                No previous versions recorded for this secret yet. Previous versions are archived upon update.
              </p>
            )}

            {!loadingHistory && versions.length > 0 && (
              <div className="divide-y divide-[#171717] max-h-72 overflow-y-auto pr-1">
                {versions.map((ver) => (
                  <div key={ver.id} className="py-3 flex items-center justify-between gap-4 text-xs font-mono">
                    <div>
                      <div className="text-white font-semibold">Version {ver.version}</div>
                      <div className="text-gray-500 text-[11px] truncate max-w-xs">{ver.value}</div>
                      <div className="text-gray-600 text-[10px] mt-0.5">
                        {new Date(ver.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRollback(ver.id, ver.version)}
                      disabled={rollingBack}
                      className="px-2.5 py-1 rounded bg-[#1c1c1c] hover:bg-[#262626] border border-[#303030] text-green-400 text-xs font-mono flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Webhook */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-green-400" />
              <span>Add Security Webhook</span>
            </h2>
            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  SLACK OR DISCORD WEBHOOK URL
                </label>
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/... or discord.com/api/webhooks/..."
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#222222] text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWebhook}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs flex items-center gap-2"
                >
                  {creatingWebhook && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Webhook</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Team Invite */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-green-400" />
              <span>Invite Team Member</span>
            </h2>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">NAME (OPTIONAL)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">ROLE (RBAC)</label>
                <select
                  value={inviteRole}
                  onChange={(e: any) => setInviteRole(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                >
                  <option value="ADMIN">ADMIN &mdash; Full write, invite, & token permissions</option>
                  <option value="MEMBER">MEMBER &mdash; Read & write environment secrets</option>
                  <option value="VIEWER">VIEWER &mdash; Read-only dev secrets; no tokens</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#222222] text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs flex items-center gap-2"
                >
                  {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Secret */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Add Secret ({activeEnv.toUpperCase()})</h2>
            <form onSubmit={handleSaveSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">KEY NAME</label>
                <input
                  type="text"
                  required
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="e.g. DATABASE_URL or API_KEY"
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-green-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">SECRET VALUE</label>
                <textarea
                  required
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="Plaintext secret value to encrypt"
                  rows={3}
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">COMMENT (OPTIONAL)</label>
                <input
                  type="text"
                  value={secretComment}
                  onChange={(e) => setSecretComment(e.target.value)}
                  placeholder="e.g. Primary production database connection string"
                  className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSecretModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#222222] text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSecret}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs flex items-center gap-2"
                >
                  {savingSecret && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingSecret ? 'Encrypting & Saving...' : 'Save Secret'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Generate Token */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Generate Service Token</h2>

            {generatedPlaintextToken ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-950/30 border border-green-800 rounded-lg text-xs text-green-300">
                  <p className="font-bold">Token Created!</p>
                  <p className="mt-1">
                    Copy this token now. For security reasons, it will never be displayed again.
                  </p>
                </div>

                <div className="font-mono text-xs bg-[#161616] p-3 rounded-lg border border-[#2b2b2b] break-all text-green-400 flex items-center justify-between gap-2">
                  <span>{generatedPlaintextToken}</span>
                  <button
                    onClick={() => copyToClipboard(generatedPlaintextToken, 'token')}
                    className="p-1 rounded hover:bg-[#222222] text-gray-300"
                  >
                    {copiedKey === 'token' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-mono">Use with Keyzen CLI:</p>
                  <pre className="bg-black border border-[#222222] p-2.5 rounded text-[11px] font-mono text-gray-300 overflow-x-auto">
                    {`keyzen run --token ${generatedPlaintextToken} -- npm start`}
                  </pre>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setGeneratedPlaintextToken(null);
                      setShowTokenModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setGeneratingToken(true);
                    const res = await fetch('/api/tokens', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        projectId,
                        environmentSlug: activeEnv,
                        name: tokenName.trim(),
                      }),
                    });
                    const d = await res.json();
                    setGeneratedPlaintextToken(d.token);
                    await fetchTokens();
                  } catch (e: any) {
                    alert(e.message);
                  } finally {
                    setGeneratingToken(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">TOKEN NAME</label>
                  <input
                    type="text"
                    required
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g. CI/CD or Local Dev"
                    className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTokenModal(false)}
                    className="px-4 py-2 rounded-lg bg-[#222222] text-xs text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingToken}
                    className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs flex items-center gap-2"
                  >
                    {generatingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{generatingToken ? 'Generating...' : 'Generate Token'}</span>
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
