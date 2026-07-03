'use client';

import { useState } from 'react';

interface ToolCallEntry {
  step: number;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

const ARGS_TRUNCATE_LEN = 200;

function ToolCallArgs({ args }: { args: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const full = JSON.stringify(args, null, 2);
  const truncated = full.length > ARGS_TRUNCATE_LEN;
  const displayed = !truncated || expanded ? full : `${full.slice(0, ARGS_TRUNCATE_LEN)}…`;
  return (
    <div className="mt-0.5">
      <pre className="text-[10px] text-muted-foreground/60 whitespace-pre-wrap">{displayed}</pre>
      {truncated && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-[10px] text-primary/70 hover:text-primary underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function AgentOutputView({ output }: { output: Record<string, unknown> }) {
  const toolLog = output['__toolCallLog'] as ToolCallEntry[] | undefined;
  const memoryUpdates = output['__memoryUpdates'] as Record<string, unknown> | undefined;
  const agentValue = output['__agentValue'] as string | undefined;
  const hasTools = toolLog && toolLog.length > 0;
  const hasMemory = memoryUpdates && Object.keys(memoryUpdates).length > 0;

  if (!hasTools && !hasMemory) {
    const text = agentValue ?? JSON.stringify(output, null, 2);
    return <pre className="whitespace-pre-wrap break-words">{text}</pre>;
  }

  return (
    <div className="space-y-2">
      {hasTools && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">
            Tool calls ({toolLog!.length})
          </p>
          <div className="space-y-1">
            {toolLog!.map((tc, i) => {
              const denied = typeof tc.result === 'object' && tc.result !== null && (tc.result as { denied?: boolean }).denied;
              return (
                <div key={i} className="rounded border border-border/40 bg-muted/30 px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono font-semibold ${denied ? 'text-muted-foreground/50 line-through' : 'text-foreground/80'}`}>
                      {tc.name}
                    </span>
                    {denied && (
                      <span className="text-[9px] text-muted-foreground/60 border border-border/50 rounded px-1">denied</span>
                    )}
                  </div>
                  {tc.args && Object.keys(tc.args).length > 0 && (
                    <ToolCallArgs args={tc.args} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {hasMemory && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">
            Memory
          </p>
          <div className="space-y-0.5">
            {Object.entries(memoryUpdates!).map(([k, v]) => (
              <div key={k} className="flex gap-1.5 font-mono text-[10px]">
                <span className="text-foreground/60 shrink-0">{k}</span>
                <span className="text-muted-foreground/60 truncate">{JSON.stringify(v).slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {agentValue && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Output</p>
          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">{agentValue.slice(0, 300)}</p>
        </div>
      )}
    </div>
  );
}
