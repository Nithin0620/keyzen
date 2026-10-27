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

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [activeEnv, setActiveEnv] = useState<'dev' | 'staging' | 'prod'>('dev');
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [tokens, setTokens] = useState<ServiceTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Secret visibility toggle map: { [secretId]: boolean }
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});

  // Add / Edit Secret Modal
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretComment, setSecretComment] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);

  // Generate Token Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenName, setTokenName] = useState('Local Dev');
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedPlaintextToken, setGeneratedPlaintextToken] = useState<string | null>(null);

  // Copy feedback states
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

  useEffect(() => {
    fetchSecrets();
    fetchTokens();
  }, [projectId, activeEnv]);

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

  const handleDeleteSecret = async (secretId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete secret ${name}?`)) return;

    try {
      const res = await fetch(`/api/secrets?secretId=${secretId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchSecrets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
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
      if (!res.ok) throw new Error('Failed to create token');
      const data = await res.json();
      setGeneratedPlaintextToken(data.token);
      await fetchTokens();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this service token?')) return;
    try {
      await fetch(`/api/tokens?id=${id}`, { method: 'DELETE' });
      await fetchTokens();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Back button & Title */}
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] text-xs text-gray-200 font-medium transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-green-400" />
              <span>Generate Token</span>
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

      {/* Environment Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
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

        {error && (
          <div className="p-4 bg-red-950/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && secrets.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm">No secrets in {activeEnv.toUpperCase()} environment.</p>
            <button
              onClick={() => setShowSecretModal(true)}
              className="mt-3 px-3 py-1.5 rounded bg-[#161616] border border-[#282828] text-green-400 text-xs font-mono hover:bg-[#202020] transition-colors"
            >
              + Add First Secret
            </button>
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
                    <div className="font-mono text-sm font-bold text-white tracking-wide">
                      {secret.name}
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

                  <div className="flex items-center gap-2 self-end sm:self-auto">
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
                      onClick={() => handleDeleteSecret(secret.id, secret.name)}
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

      {/* Service Tokens Section */}
      <div className="bg-[#0b0b0b] border border-[#222222] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-green-400" />
              Service Tokens
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Used by the Keyzen CLI to decrypt and inject secrets in CI/CD or local dev.
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
                  onClick={() => handleRevokeToken(token.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Secret Modal */}
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
                  className="px-4 py-2 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-xs text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSecret}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs transition-colors flex items-center gap-2"
                >
                  {savingSecret && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingSecret ? 'Encrypting & Saving...' : 'Save Secret'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Token Modal */}
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
              <form onSubmit={handleGenerateToken} className="space-y-4">
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

                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">ENVIRONMENT</label>
                  <select
                    value={activeEnv}
                    onChange={(e: any) => setActiveEnv(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="dev">Development (dev)</option>
                    <option value="staging">Staging (staging)</option>
                    <option value="prod">Production (prod)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTokenModal(false)}
                    className="px-4 py-2 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-xs text-gray-300"
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
