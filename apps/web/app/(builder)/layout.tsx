'use client';

import { WorkspaceProvider } from '@/contexts/workspace-context';

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
