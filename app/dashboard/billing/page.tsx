'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Check,
  Shield,
  Zap,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface BillingStatus {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  projectsCount: number;
  maxProjects: number;
  secretsCount: number;
  maxSecrets: number;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchBilling = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/status');
      const data = await res.json();
      setBilling(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleUpgrade = async (plan: 'PRO' | 'FREE') => {
    try {
      setUpgrading(true);
      setSuccessMessage(null);
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlan: plan }),
      });
      const data = await res.json();
      setSuccessMessage(data.message || `Switched to ${plan} plan!`);
      await fetchBilling();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpgrading(false);
    }
  };

  const isPro = billing?.plan === 'PRO' || billing?.plan === 'ENTERPRISE';

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-3 font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-green-400" />
          <span>Plans & Billing</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Manage your Keyzen subscription, usage limits, and enterprise features.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-green-950/40 border border-green-800 text-green-300 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-[#0c0c0c] border border-[#222222] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span>PROJECTS LIMIT</span>
            <span className="text-white font-bold">
              {billing?.projectsCount || 0} / {billing?.maxProjects || 3}
            </span>
          </div>
          <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((billing?.projectsCount || 0) / (billing?.maxProjects || 3)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            {isPro ? 'Unlimited projects on Pro tier.' : 'Free tier allows up to 3 projects.'}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0c0c0c] border border-[#222222] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span>STORED SECRETS LIMIT</span>
            <span className="text-white font-bold">
              {billing?.secretsCount || 0} / {billing?.maxSecrets || 25}
            </span>
          </div>
          <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((billing?.secretsCount || 0) / (billing?.maxSecrets || 25)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            {isPro ? 'Unlimited secrets on Pro tier.' : 'Free tier allows up to 25 secrets.'}
          </p>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Free Plan */}
        <div
          className={`p-6 rounded-2xl bg-[#0c0c0c] border ${
            !isPro ? 'border-green-500/50 shadow-lg shadow-green-500/5' : 'border-[#222222]'
          } space-y-6 flex flex-col justify-between`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Developer Free</h2>
              {!isPro && (
                <span className="text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded">
                  Current Plan
                </span>
              )}
            </div>
            <div className="text-3xl font-extrabold text-white">
              $0 <span className="text-xs font-normal text-gray-400 font-mono">/ forever</span>
            </div>
            <p className="text-xs text-gray-400">
              Essential zero-disk secret injection for individual builders and indie projects.
            </p>

            <ul className="space-y-2 text-xs text-gray-300 font-sans pt-2">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Up to 3 Projects</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Up to 25 Encrypted Secrets</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>AES-256-GCM Envelope Encryption</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Keyzen Zero-Disk CLI</span>
              </li>
            </ul>
          </div>

          <div>
            {isPro ? (
              <button
                onClick={() => handleUpgrade('FREE')}
                disabled={upgrading}
                className="w-full py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs font-semibold text-gray-300 border border-[#303030] transition-colors"
              >
                Downgrade to Free
              </button>
            ) : (
              <button
                disabled
                className="w-full py-2.5 rounded-xl bg-[#161616] text-xs font-semibold text-gray-500 border border-[#222222] cursor-default"
              >
                Active
              </button>
            )}
          </div>
        </div>

        {/* Pro Plan */}
        <div
          className={`p-6 rounded-2xl bg-gradient-to-b from-[#111111] to-[#0c0c0c] border ${
            isPro ? 'border-green-500 shadow-xl shadow-green-500/10' : 'border-[#2f2f2f]'
          } space-y-6 flex flex-col justify-between`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Team Pro</h2>
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              {isPro && (
                <span className="text-[10px] font-mono uppercase bg-green-500 text-black font-bold px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            <div className="text-3xl font-extrabold text-white">
              $15 <span className="text-xs font-normal text-gray-400 font-mono">/ month</span>
            </div>
            <p className="text-xs text-gray-400">
              Complete security platform for growing teams, CI/CD automation, and auditing.
            </p>

            <ul className="space-y-2 text-xs text-gray-300 font-sans pt-2">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="font-semibold text-white">Unlimited Projects & Secrets</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Secret Version History & 1-Click Rollback</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Full Audit Trail & Access Logs</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Slack & Discord Security Webhooks</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Team RBAC Workspaces</span>
              </li>
            </ul>
          </div>

          <div>
            {!isPro ? (
              <button
                onClick={() => handleUpgrade('PRO')}
                disabled={upgrading}
                className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {upgrading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{upgrading ? 'Upgrading...' : 'Upgrade to Pro'}</span>
              </button>
            ) : (
              <button
                disabled
                className="w-full py-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/30 text-xs font-semibold cursor-default"
              >
                Plan Active
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
