'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Loader2 } from 'lucide-react';

export default function DashboardIndex(): React.ReactNode {
  const { activeWorkspace, workspaces, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (activeWorkspace) {
      router.replace(`/workspaces/${activeWorkspace.id}/projects`);
    } else if (workspaces.length > 0) {
      router.replace(`/workspaces/${workspaces[0].id}/projects`);
    } else {
      router.replace('/workspaces/new');
    }
  }, [activeWorkspace, workspaces, isLoading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy text-ink">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-peri-2" />
        <p className="font-mono text-xs text-ink-3">Entering Aegis Studio...</p>
      </div>
    </div>
  );
}
