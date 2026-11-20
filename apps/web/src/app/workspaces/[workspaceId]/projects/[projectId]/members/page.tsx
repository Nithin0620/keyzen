'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectRbacPanel } from '@/components/rbac/project-rbac-panel';

export default function ProjectMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}): React.ReactNode {
  const { workspaceId, projectId } = use(params);

  return (
    <div className="space-y-6">
      <Link
        href={`/workspaces/${workspaceId}/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Back to project
      </Link>
      <ProjectRbacPanel workspaceId={workspaceId} projectId={projectId} />
    </div>
  );
}
