'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { WorkflowSquare01Icon, Loading01Icon, Cancel01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { ResumedDivider, StepRow } from './chat-preview-step-row';
import { fmtMs } from './chat-preview-helpers';
import type { NodeStep } from './chat-preview-panel.types';

export function StepsTrace({
  steps,
  streamingText,
  streamingNodeId,
}: {
  steps: NodeStep[];
  streamingText: string;
  streamingNodeId: string | null;
}) {
  const isRunning = steps.some((s) => s.status === 'running');
  const [expanded, setExpanded] = useState(true);
  const realStepCount = steps.filter((s) => s.status !== 'divider').length;

  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const hasFailed = steps.some((s) => s.status === 'failed');

  return (
    <div className="flex gap-2 items-start">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
        <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {isRunning ? (
              <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin text-muted-foreground/70" />
            ) : hasFailed ? (
              <span className="size-1.5 rounded-full bg-destructive/70" />
            ) : (
              <span className="size-1.5 rounded-full bg-foreground/25" />
            )}
            <span>{realStepCount} step{realStepCount !== 1 ? 's' : ''}</span>
            {!isRunning && totalMs > 0 && (
              <span className="opacity-50">· {fmtMs(totalMs)}</span>
            )}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`size-2.5 opacity-40 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          {!isRunning && expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              aria-label="Close trace"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
            </button>
          )}
        </div>

        {expanded && steps.length > 0 && (
          <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
            {steps.map((step) =>
              step.status === 'divider' ? (
                <ResumedDivider key={step.nodeId} />
              ) : (
                <StepRow
                  key={step.nodeId}
                  step={step}
                  streamingText={
                    step.nodeId === streamingNodeId && step.status === 'running'
                      ? streamingText
                      : undefined
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
