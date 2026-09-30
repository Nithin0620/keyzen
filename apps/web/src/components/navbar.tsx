'use client';

import React from 'react';
import Link from 'next/link';
import { KeyRound, Shield, Terminal, BookOpen, Layers } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-100 border border-border group-hover:border-accent/50 transition-colors">
              <KeyRound className="h-4 w-4 text-accent" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              Keyzen
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-accent/10 text-accent border border-accent/20">
                v0.1
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted">
            <Link href="/" className="hover:text-white transition-colors text-white flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-accent" />
              Projects
            </Link>
            <Link href="#cli" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              CLI & SDK
            </Link>
            <Link href="#audit" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Security
            </Link>
          </nav>
        </div>

        {/* Right action / status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-100 border border-border text-xs text-muted-foreground font-mono">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span>AES-256-GCM Active</span>
          </div>
          <div className="h-7 w-7 rounded-full bg-surface-100 border border-border flex items-center justify-center text-xs font-medium text-white">
            N
          </div>
        </div>
      </div>
    </header>
  );
}
