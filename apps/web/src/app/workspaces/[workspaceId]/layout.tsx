import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function WorkspaceLayout({ children }: { children: ReactNode }): ReactNode {
  return <DashboardShell>{children}</DashboardShell>;
}
