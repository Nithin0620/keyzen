'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, BookOpen, Code2, LayoutDashboard, ShieldCheck, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/docs', label: 'Start here', hint: 'Quickstart', icon: BookOpen },
  { href: '/docs/sdk', label: 'SDK reference', hint: 'Every method', icon: Code2 },
  { href: '/docs/cli', label: 'CLI reference', hint: 'Every command', icon: Terminal },
  { href: '/docs/security', label: 'Security model', hint: 'Tokens & limits', icon: ShieldCheck },
];

export function DocsSidebar(): ReactNode {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-28 lg:h-fit lg:w-64 lg:shrink-0">
      <p className="mb-3 hidden font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3 lg:block">Documentation</p>
      <nav aria-label="Documentation" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {links.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition lg:w-full',
                active
                  ? 'border-peri/50 bg-peri/10 text-ink shadow-peri-glow/20'
                  : 'border-line-subtle bg-white/[0.02] text-ink-2 hover:border-peri/30 hover:text-ink'
              )}
            >
              <Icon className={cn('size-4 shrink-0', active ? 'text-peri-2' : 'text-ink-3')} />
              <span className="min-w-0">
                <span className="block font-medium">{link.label}</span>
                <span className="hidden text-xs text-ink-3 lg:block">{link.hint}</span>
              </span>
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-3 rounded-xl border border-line-subtle bg-white/[0.02] px-3 py-2.5 text-sm text-ink-2 transition hover:border-peri/30 hover:text-ink lg:w-full"
        >
          <LayoutDashboard className="size-4 shrink-0 text-ink-3" />
          <span className="font-medium">Open dashboard</span>
          <ArrowUpRight className="ml-auto size-3.5 text-ink-3" />
        </Link>
      </nav>
    </aside>
  );
}
