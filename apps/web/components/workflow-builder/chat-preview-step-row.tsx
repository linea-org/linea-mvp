'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { JsonOrPre } from '@/components/ui/json-or-pre';
import { AgentOutputView } from './chat-preview-agent-output';
import { fmtMs } from './chat-preview-helpers';
import type { NodeStep } from './chat-preview-panel.types';

export function ResumedDivider() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0 border-border/40">
      <div className="flex-1 h-px bg-border/40" />
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 shrink-0">Resumed</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

export function StepRow({ step, streamingText }: { step: NodeStep; streamingText?: string }) {
  const [outputOpen, setOutputOpen] = useState(false);

  // agentStreamedText is written by the panel when the node reaches a terminal state,
  // so it is always complete and race-free (no effect-based capture needed here).
  const persistedText = step.agentStreamedText;
  const hasContent = step.output !== undefined || !!step.error || !!persistedText;

  const agentOutput = (
    step.output !== null &&
    typeof step.output === 'object' &&
    ('__toolCallLog' in (step.output as object) || '__memoryUpdates' in (step.output as object))
  ) ? step.output as Record<string, unknown> : null;

  const toolCount = agentOutput
    ? ((agentOutput['__toolCallLog'] as unknown[] | undefined)?.length ?? 0)
    : 0;
  const memoryCount = agentOutput
    ? Object.keys((agentOutput['__memoryUpdates'] as Record<string, unknown> | undefined) ?? {}).length
    : 0;

  return (
    <div className="border-b last:border-b-0 border-border/40">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
        {step.status === 'running' ? (
          <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin text-muted-foreground/70 shrink-0" />
        ) : step.status === 'completed' ? (
          <span className="size-1.5 rounded-full bg-foreground/25 shrink-0" />
        ) : step.status === 'suspended' ? (
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-pulse shrink-0" />
        ) : (
          <span className="size-1.5 rounded-full bg-destructive/70 shrink-0" />
        )}

        <span className="flex-1 font-medium text-foreground/80 truncate">{step.nodeName}</span>

        {toolCount > 0 && (
          <span className="text-[9px] text-muted-foreground/60 border border-border/50 rounded px-1 shrink-0">
            {toolCount}t
          </span>
        )}
        {memoryCount > 0 && (
          <span className="text-[9px] text-muted-foreground/60 border border-border/50 rounded px-1 shrink-0">
            mem
          </span>
        )}

        {step.nodeType && step.nodeType !== step.nodeName && (
          <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0">{step.nodeType}</span>
        )}

        {step.durationMs !== undefined && (
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtMs(step.durationMs)}</span>
        )}

        {hasContent && (
          <button
            onClick={() => setOutputOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`size-2.5 transition-transform duration-150 ${outputOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {streamingText && step.status === 'running' && (
        <div className="px-3 pb-2 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border-t border-border/40 bg-muted/20">
          {streamingText}
          <span className="inline-block size-1.5 bg-current rounded-full animate-pulse ml-0.5 align-middle" />
        </div>
      )}

      {outputOpen && (
        <>
          {persistedText && (
            <div className="px-3 pt-2 pb-2 text-[11px] text-muted-foreground bg-muted/20 border-t border-border/40">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Streamed output</p>
              <pre className="whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto">{persistedText}</pre>
            </div>
          )}

          {step.output !== undefined && (
            <div className="px-3 pb-2 text-[11px] text-muted-foreground max-h-64 overflow-y-auto bg-muted/20 border-t border-border/40">
              {agentOutput ? (
                <AgentOutputView output={agentOutput} />
              ) : (
                <JsonOrPre value={step.output} className="text-[11px]" />
              )}
            </div>
          )}

          {step.error && (
            <div className="px-3 pb-2 text-[11px] text-destructive border-t border-border/40">
              {step.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
