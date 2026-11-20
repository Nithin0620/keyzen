import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Aegis SDK & CLI Documentation',
  description: 'Install, configure, and use the Aegis SDK and CLI to inject secrets safely at runtime.',
};

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return <DocsShell>{children}</DocsShell>;
}
