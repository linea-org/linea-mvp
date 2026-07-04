'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { WorkflowSquare01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { CreatedWorkflow } from './types';

export function WorkflowArtifactCard({ wf }: { wf: CreatedWorkflow }) {
  const href = wf.podId ? `/pods/${wf.podId}/workflows/${wf.id}` : null;
  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Workflow created</p>
          <p className="text-sm font-semibold truncate mt-0.5">{wf.name}</p>
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Open
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
