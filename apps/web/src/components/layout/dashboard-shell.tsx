'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  ShieldCheck,
  FolderGit2,
  KeyRound,
  History,
  Users,
  Settings,
  ChevronDown,
  Menu,
  LogOut,
  Building,
  Plus,
  Radio,
  CreditCard,
  Loader2,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: typeof FolderGit2;
  matchPrefix?: boolean;
}

export function DashboardShell({ children }: { children: React.ReactNode }): React.ReactNode {
  const pathname = usePathname();
  const { user, activeWorkspace, workspaces, selectWorkspace, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems: NavItem[] = activeWorkspace
    ? [
        {
          name: 'Projects',
          href: `/workspaces/${activeWorkspace.id}/projects`,
          icon: FolderGit2,
          matchPrefix: true,
        },
        {
          name: 'Secrets Vault',
          href: `/workspaces/${activeWorkspace.id}/secrets`,
          icon: KeyRound,
          matchPrefix: true,
        },
        {
          name: 'Audit Trail',
          href: `/workspaces/${activeWorkspace.id}/audit`,
          icon: History,
          matchPrefix: true,
        },
        {
          name: 'Team & RBAC',
          href: `/workspaces/${activeWorkspace.id}/members`,
          icon: Users,
          matchPrefix: true,
        },
        {
          name: 'Billing',
          href: `/workspaces/${activeWorkspace.id}/billing`,
          icon: CreditCard,
          matchPrefix: true,
        },
        {
          name: 'Settings',
          href: `/workspaces/${activeWorkspace.id}/settings`,
          icon: Settings,
        },
      ]
    : [];

  const isActive = (item: NavItem): boolean => {
    if (item.matchPrefix) {
      return pathname.startsWith(item.href);
    }
    return pathname === item.href;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-navy text-foreground selection:bg-peri/30 selection:text-ink">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-peri focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-line/30 bg-navy-deep/80 backdrop-blur-xl md:flex h-screen shrink-0 sticky top-0">
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-6 border-b border-line/20">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <div>
            <span className="font-sans text-base font-semibold tracking-tight text-ink">Aegis</span>
            <span className="ml-1.5 font-mono text-[10px] text-peri-2">STUDIO</span>
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="p-4 shrink-0 border-b border-line/20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between border-line/40 bg-navy-deep/40 text-ink hover:bg-navy-deep/70 hover:text-white text-xs h-9 px-3"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building className="size-3.5 text-peri-2 shrink-0" />
                  <span className="truncate">{activeWorkspace?.name ?? 'Select Workspace'}</span>
                </div>
                <ChevronDown className="size-3.5 text-ink-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 border-line/40 bg-popover text-ink">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                Workspaces
              </DropdownMenuLabel>
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => void selectWorkspace(ws.id)}
                  className="flex items-center justify-between cursor-pointer text-xs focus:bg-peri/20 focus:text-white"
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspace?.id && (
                    <span className="size-1.5 rounded-full bg-peri-2 shadow-[0_0_6px_theme(colors.peri.2)]" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-line/20" />
              <Link href="/workspaces/new">
                <DropdownMenuItem className="cursor-pointer text-xs text-peri-2 focus:bg-peri/20 focus:text-white">
                  <Plus className="mr-2 size-3.5" /> Create Workspace
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-wider text-ink-3">
            Navigation
          </div>
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                  active
                    ? 'bg-peri/20 text-white font-medium border-l-2 border-peri-2'
                    : 'text-ink-2 hover:bg-line/[0.05] hover:text-ink'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-peri-2' : 'text-ink-3'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-line/20 p-4 shrink-0 mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="flex size-7 items-center justify-center rounded-full bg-peri/30 font-mono text-xs font-semibold text-peri-2">
                {user?.name ? user.name[0]?.toUpperCase() : 'U'}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-medium text-ink">{user?.name ?? 'Developer'}</p>
                <p className="truncate font-mono text-[10px] text-ink-3">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await logout();
                } finally {
                  setLoggingOut(false);
                }
              }}
              title="Sign Out"
              className="size-8 text-ink-3 hover:text-destructive"
            >
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin text-destructive" />
              ) : (
                <LogOut className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line/20 bg-navy-deep/60 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {/* Mobile Sheet Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-line/30 bg-navy p-0 text-ink">
                <SheetHeader className="h-16 flex-row items-center gap-3 border-b border-line/20 px-6">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
                    <ShieldCheck className="size-4 text-white" />
                  </div>
                  <SheetTitle className="font-sans text-base font-semibold text-ink">Aegis</SheetTitle>
                </SheetHeader>
                <nav className="space-y-1 p-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        isActive(item)
                          ? 'bg-peri/20 text-white font-medium'
                          : 'text-ink-2 hover:bg-line/[0.05]'
                      }`}
                    >
                      <item.icon className="size-4 text-peri-2" />
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Breadcrumb path */}
            <div className="flex items-center gap-2 font-mono text-xs text-ink-3">
              <span className="text-ink-2">{activeWorkspace?.name ?? 'Workspace'}</span>
              <span>/</span>
              <span className="text-peri-2">Studio</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="live">
              <Radio className="mr-1 size-3" /> SEALED
            </Badge>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
