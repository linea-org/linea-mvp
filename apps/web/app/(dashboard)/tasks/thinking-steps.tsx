'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading01Icon } from '@hugeicons/core-free-icons';
import { TOOL_LABELS } from './constants';
import type { ToolCall } from './types';

export function ThinkingSteps({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [open, setOpen] = useState(false);
  if (toolCalls.length === 0) return null;

  const allDone = toolCalls.every((tc) => tc.result !== undefined);
  const activeName = !allDone ? (toolCalls.find((tc) => tc.result === undefined)?.name ?? '') : '';

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors group"
      >
        {allDone ? (
          <span className="flex size-3 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">✓</span>
        ) : (
          <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin text-muted-foreground/60 shrink-0" />
        )}
        <span className="italic">
          {allDone
            ? `${toolCalls.length} step${toolCalls.length !== 1 ? 's' : ''} taken`
            : (TOOL_LABELS[activeName] ? `${TOOL_LABELS[activeName]}…` : 'Working…')}
        </span>
        <span className="text-[9px] text-muted-foreground/40">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-1 pl-4 border-l border-border/50">
          {toolCalls.map((tc, i) => (
            <ThinkingStepRow key={tc.id} tc={tc} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingStepRow({ tc, index }: { tc: ToolCall; index: number }) {
  const [open, setOpen] = useState(false);
  const done = tc.result !== undefined;
  const hasDetails = Object.keys(tc.input).length > 0 || done;

  return (
    <div className="text-[11px]">
      <button
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`flex w-full items-center gap-1.5 py-0.5 text-left ${hasDetails ? 'cursor-pointer hover:text-muted-foreground' : 'cursor-default'} text-muted-foreground/60 transition-colors`}
      >
        <span className="shrink-0 w-3.5 text-center text-[9px] text-muted-foreground/40">{index}.</span>
        {done
          ? <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[7px] text-muted-foreground">✓</span>
          : <HugeiconsIcon icon={Loading01Icon} className="size-2.5 shrink-0 animate-spin text-muted-foreground/40" />
        }
        <span className="italic">{TOOL_LABELS[tc.name] ?? tc.name}</span>
        {!done && <span className="text-[9px] text-muted-foreground/40">running…</span>}
        {hasDetails && (
          <span className="ml-auto text-[9px] text-muted-foreground/30">{open ? '▲' : '▼'}</span>
        )}
      </button>

      {open && hasDetails && (
        <div className="ml-5 mt-1 mb-1 space-y-1.5 rounded-md border border-border/40 bg-muted/10 px-2.5 py-2">
          {Object.keys(tc.input).length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Input</p>
              <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap break-all">{JSON.stringify(tc.input, null, 2)}</pre>
            </div>
          )}
          {done && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Result</p>
              <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap break-all">{JSON.stringify(tc.result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
