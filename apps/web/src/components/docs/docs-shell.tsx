import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocsSidebar } from './docs-sidebar';

export function DocsShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="ambient-scene min-h-screen text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-navy/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/aegis.html" className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-ink">
              <span className="size-2.5 rounded-full bg-peri shadow-peri-glow" />
              Aegis
            </Link>
            <span className="hidden items-center gap-2 text-sm text-ink-3 sm:flex">
              <BookOpen className="size-4" />
              Docs
            </span>
          </div>
          <nav aria-label="Main" className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/docs/sdk">SDK</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/docs/cli">CLI</Link>
            </Button>
            <Button asChild variant="glass" size="sm">
              <Link href="/dashboard">
                Dashboard
                <ArrowUpRight />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 lg:flex-row lg:gap-12 lg:px-8 lg:py-12">
        <DocsSidebar />
        <main className="min-w-0 flex-1 pb-24">{children}</main>
      </div>
    </div>
  );
}
