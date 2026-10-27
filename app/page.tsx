'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  KeyRound,
  Shield,
  Terminal,
  Zap,
  Lock,
  Layers,
  ArrowRight,
  Check,
  Copy,
  Cpu,
  Server,
  Code2,
  RefreshCw,
} from 'lucide-react';

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const command = 'keyzen run -- npm start';

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-24 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono">
          <Shield className="w-3.5 h-3.5" />
          <span>Zero-Disk Developer Secrets Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
          Never write a <span className="text-green-400 underline decoration-green-500/40">.env</span> file to disk again.
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-sans">
          Keyzen securely encrypts your production secrets with AES-256-GCM envelope encryption and injects them directly into application process memory at runtime.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/10"
          >
            <span>Open Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/cli"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#141414] hover:bg-[#1c1c1c] border border-[#2b2b2b] text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            <Terminal className="w-4 h-4 text-green-400" />
            <span>CLI Guidance & Docs</span>
          </Link>
        </div>
      </section>

      {/* Interactive CLI Terminal Mockup */}
      <section className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] shadow-2xl overflow-hidden">
          {/* Terminal Window Header */}
          <div className="bg-[#141414] px-4 py-3 border-b border-[#222222] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs font-mono text-gray-400">bash &mdash; keyzen runtime</span>
            </div>
            <button
              onClick={copyCommand}
              className="flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Terminal Content */}
          <div className="p-6 font-mono text-xs sm:text-sm space-y-3 leading-relaxed">
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-green-400">$</span>
              <span className="text-white">keyzen login kzn_prod_99f381...</span>
            </div>
            <div className="text-gray-500">✔ Authenticated with Keyzen Cloud Vault</div>

            <div className="flex items-center gap-2 text-gray-400 pt-2">
              <span className="text-green-400">$</span>
              <span className="text-white font-semibold">keyzen run -- npm start</span>
            </div>
            <div className="text-cyan-400">⚡ Fetching secrets from Keyzen Cloud...</div>
            <div className="text-green-400">✔ Injected 12 secrets into RAM (0 bytes written to disk)</div>
            <div className="text-gray-400 pt-1">
              [server] Starting Next.js / Express production server on port 3000...<br />
              [server] Database connected: <span className="text-green-300 font-bold">postgresql://***@aws-pooler...</span><br />
              [server] Stripe webhook listener ready &bull; OpenAI API Key loaded
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Architected for Developer Security & Speed
          </h2>
          <p className="text-sm text-gray-400">
            Everything your team needs to eliminate secret leaks, outmoded .env files, and complex vault setups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-[#222222] space-y-3 hover:border-green-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Zero-Disk Injection</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Injects decrypted environment variables directly into child process memory. No temporary files or plaintext secrets are ever left on local drives or CI runners.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-[#222222] space-y-3 hover:border-green-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Envelope Encryption</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Every project derives a distinct 256-bit AES-GCM key using HKDF-SHA256. Database storage contains only authenticated ciphertext, 96-bit IVs, and auth tags.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-[#222222] space-y-3 hover:border-green-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Environment Isolation</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Separate credentials across Development, Staging, and Production. Generate scoped service tokens for CI/CD pipelines without exposing production keys.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-[#222222] space-y-3 hover:border-green-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Sub-300ms Resolution</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Consolidated single-roundtrip PostgreSQL queries with pre-warmed connection pooling ensure instantaneous startup times for applications and CI runners.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-[#222222] space-y-3 hover:border-green-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Language Agnostic</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Works with any tech stack: Node.js, Python, Go, Rust, Docker, or Kubernetes. If it can read `process.env`, it works out of the box with `keyzen run`.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-[#222222] space-y-3 hover:border-green-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Instant Token Revocation</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Revoke compromised tokens with a single click. SHA-256 hashed token lookup makes revoked keys immediately unusable across all runtime instances.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="space-y-8 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">How Keyzen Compares</h2>
          <p className="text-xs text-gray-400">Why modern development teams choose zero-disk injection.</p>
        </div>

        <div className="border border-[#222222] rounded-2xl overflow-hidden bg-[#0c0c0c]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#141414] border-b border-[#222222] text-gray-400 font-mono">
              <tr>
                <th className="p-4">Feature</th>
                <th className="p-4 text-red-400">Raw .env Files</th>
                <th className="p-4 text-yellow-400">HashiCorp Vault</th>
                <th className="p-4 text-green-400 font-bold">Keyzen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717] text-gray-300">
              <tr>
                <td className="p-4 font-semibold text-white">Zero-Disk Footprint</td>
                <td className="p-4 text-red-400">No (plaintext on disk)</td>
                <td className="p-4 text-gray-400">Requires agent/sidecar</td>
                <td className="p-4 text-green-400 font-bold">Yes (RAM only)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Setup Time</td>
                <td className="p-4 text-gray-400">1 minute</td>
                <td className="p-4 text-red-400">Days / Complex Infra</td>
                <td className="p-4 text-green-400 font-bold">60 seconds</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Envelope Cryptography</td>
                <td className="p-4 text-red-400">None</td>
                <td className="p-4 text-green-400">Yes</td>
                <td className="p-4 text-green-400 font-bold">AES-256-GCM</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Developer Experience</td>
                <td className="p-4 text-yellow-400">Manual copy-paste</td>
                <td className="p-4 text-red-400">Heavy CLI & auth flow</td>
                <td className="p-4 text-green-400 font-bold">`keyzen run -- npm start`</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">CI/CD Token Revocation</td>
                <td className="p-4 text-red-400">Manual search & replace</td>
                <td className="p-4 text-green-400">Yes</td>
                <td className="p-4 text-green-400 font-bold">Instant 1-Click</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA Box */}
      <section className="rounded-2xl border border-green-500/30 bg-gradient-to-b from-green-950/20 to-black p-8 sm:p-12 text-center space-y-6 max-w-3xl mx-auto">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Ready to eliminate secret leakage?
        </h2>
        <p className="text-sm text-gray-400 max-w-lg mx-auto">
          Start securing your environments today. Run your applications securely with zero disk footprint.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-all"
          >
            <span>Launch Keyzen Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
