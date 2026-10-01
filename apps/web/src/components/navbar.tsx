'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  Layers,
  Loader2,
  LogOut,
  Shield,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/auth-context';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  /** Returns initials from a display name or email */
  const initials = (u: typeof user) => {
    if (!u) return '?';
    if (u.name) {
      return u.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return u.email[0].toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Nav */}
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
            <Link
              href="/"
              className="hover:text-white transition-colors text-white flex items-center gap-1.5"
            >
              <Layers className="h-3.5 w-3.5 text-accent" />
              Projects
            </Link>
            <Link
              href="#cli"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Terminal className="h-3.5 w-3.5" />
              CLI & SDK
            </Link>
            <Link
              href="#audit"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Shield className="h-3.5 w-3.5" />
              Security
            </Link>
          </nav>
        </div>

        {/* Right: encryption badge + user avatar */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-100 border border-border text-xs text-muted-foreground font-mono">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span>AES-256-GCM Active</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              {/* Avatar with tooltip */}
              <div className="relative group">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.name ?? user.email}
                    className="h-7 w-7 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-surface-100 border border-border flex items-center justify-center text-xs font-semibold text-accent select-none">
                    {initials(user)}
                  </div>
                )}

                {/* Dropdown on hover */}
                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 min-w-[160px]">
                  <div className="rounded-lg border border-border bg-surface-200 py-1.5 shadow-2xl">
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-xs font-semibold text-white truncate">
                        {user.name ?? 'User'}
                      </p>
                      <p className="text-[11px] text-muted truncate font-mono">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      disabled={signingOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors"
                    >
                      {signingOut ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg border border-border bg-surface-100 text-xs text-muted hover:text-white hover:border-accent/40 transition-colors font-medium"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
