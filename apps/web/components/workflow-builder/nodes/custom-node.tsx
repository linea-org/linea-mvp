'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ZapIcon,
  Square01Icon,
  Robot01Icon,
  Globe02Icon,
  CodeIcon,
  GitBranchIcon,
  CheckmarkCircle01Icon,
  Plug01Icon,
  AiBrain01Icon,
  StickyNote01Icon,
  Download04Icon,
  Database01Icon,
  Shield01Icon,
  ComputerTerminal01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@linea/ui/lib/utils';

/* ------------------------------------------------------------------ */
/*  Theme map                                                           */
/* ------------------------------------------------------------------ */
interface Theme { icon: IconSvgElement; color: string }

const defaultTheme: Theme = { icon: Robot01Icon, color: '#3b82f6' };

const themes: Record<string, Theme> = {
  start:     { icon: ZapIcon,               color: '#6366f1' },
  end:       { icon: Square01Icon,           color: '#14b8a6' },
  agent:     { icon: Robot01Icon,            color: '#3b82f6' },
  http:      { icon: Globe02Icon,            color: '#8b5cf6' },
  transform: { icon: CodeIcon,               color: '#7c3aed' },
  'if-else': { icon: GitBranchIcon,          color: '#f59e0b' },
  router:    { icon: GitBranchIcon,          color: '#ea580c' },
  approval:  { icon: CheckmarkCircle01Icon,  color: '#9ca3af' },
  mcp:        { icon: Plug01Icon,              color: '#eab308' },
  memory:     { icon: AiBrain01Icon,           color: '#a855f7' },
  extract:    { icon: Download04Icon,          color: '#0ea5e9' },
  retriever:  { icon: Database01Icon,          color: '#10b981' },
  guardrails: { icon: Shield01Icon,            color: '#ef4444' },
  code:       { icon: ComputerTerminal01Icon,  color: '#64748b' },
};

/* ------------------------------------------------------------------ */
/*  Status dot                                                          */
/* ------------------------------------------------------------------ */
function StatusDot({ status }: { status?: string }) {
  if (!status) return null;
  const dotClass =
    status === 'running'
      ? 'size-2 rounded-full bg-orange-400 animate-pulse'
      : status === 'completed'
        ? 'size-2 rounded-full bg-green-500'
        : status === 'failed'
          ? 'size-2 rounded-full bg-red-500'
          : 'size-2 rounded-full bg-muted-foreground';
  return <span className={dotClass} />;
}

/* ------------------------------------------------------------------ */
/*  Shared node shell                                                   */
/* ------------------------------------------------------------------ */
const STATUS_RING: Record<string, { border: string; shadow: string; animate?: string }> = {
  running:   { border: 'rgb(59,130,246)',  shadow: '0 0 0 3px rgba(59,130,246,0.45)', animate: 'animate-pulse' },
  completed: { border: 'rgb(34,197,94)',   shadow: '0 0 0 2px rgba(34,197,94,0.55)' },
  failed:    { border: 'rgb(239,68,68)',   shadow: '0 0 0 2px rgba(239,68,68,0.55)' },
  suspended: { border: 'rgb(245,158,11)',  shadow: '0 0 0 2px rgba(245,158,11,0.55)' },
};

function NodeShell({
  nodeType,
  label,
  status,
  selected,
  children,
}: {
  nodeType: string;
  label: string;
  status?: string;
  selected: boolean;
  children?: React.ReactNode;
}) {
  const theme = themes[nodeType] ?? defaultTheme;
  const ring = status ? STATUS_RING[status] : undefined;

  const borderColor = ring?.border ?? (selected ? theme.color : undefined);
  const boxShadow = ring
    ? ring.shadow
    : selected
      ? `0 0 0 2px ${theme.color}33, 0 2px 8px rgba(0,0,0,.10)`
      : undefined;

  return (
    <div
      className={cn(
        'min-w-44 cursor-grab rounded-xl border bg-background px-3.5 py-2.5 shadow-sm select-none transition-shadow duration-300',
        selected && !ring ? 'shadow-md' : '',
        ring?.animate ?? '',
      )}
      style={{
        borderColor: borderColor ?? 'hsl(var(--border))',
        boxShadow,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.color }}
        >
          <HugeiconsIcon icon={theme.icon} className="size-3.5 text-white" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{label}</p>
          {status && (
            <div className="mt-0.5 flex items-center gap-1">
              <StatusDot status={status} />
              <span className="text-[10px] capitalize text-muted-foreground">{status}</span>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CustomNode                                                          */
/* ------------------------------------------------------------------ */
export const CustomNode = memo(function CustomNode({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as string) ?? 'agent';
  const label = (data.nodeName as string) ?? (data.label as string) ?? nodeType;
  const status = data.status as string | undefined;
  const isBranching = nodeType === 'if-else' || nodeType === 'router';

  return (
    <NodeShell nodeType={nodeType} label={label} status={status} selected={selected}>
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground"
      />
      {isBranching ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!size-2.5 !rounded-full !border-2 !border-background !bg-green-500"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!size-2.5 !rounded-full !border-2 !border-background !bg-red-500"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!size-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground"
        />
      )}
    </NodeShell>
  );
});

/* ------------------------------------------------------------------ */
/*  StartNode                                                           */
/* ------------------------------------------------------------------ */
export const StartNode = memo(function StartNode({ data, selected }: NodeProps) {
  const label = (data.nodeName as string) ?? (data.label as string) ?? 'Start';
  return (
    <NodeShell nodeType="start" label={label} selected={selected}>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground"
      />
    </NodeShell>
  );
});

/* ------------------------------------------------------------------ */
/*  EndNode                                                             */
/* ------------------------------------------------------------------ */
export const EndNode = memo(function EndNode({ data, selected }: NodeProps) {
  const label = (data.nodeName as string) ?? (data.label as string) ?? 'End';
  return (
    <NodeShell nodeType="end" label={label} selected={selected}>
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground"
      />
    </NodeShell>
  );
});

/* ------------------------------------------------------------------ */
/*  NoteNode                                                            */
/* ------------------------------------------------------------------ */
export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState((data.noteText as string) ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={cn(
        'min-h-20 min-w-44 rounded-lg border-[1.5px] bg-yellow-50 p-3 shadow-sm select-none',
        selected ? 'border-yellow-400' : 'border-yellow-200',
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <HugeiconsIcon icon={StickyNote01Icon} className="size-3 text-yellow-700" strokeWidth={1.5} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-700">Note</span>
      </div>
      {editing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setEditing(false)}
          className="w-full min-h-10 resize-none bg-transparent border-none outline-none text-xs text-yellow-900 cursor-text"
        />
      ) : (
        <p className="m-0 min-h-10 whitespace-pre-wrap text-xs text-yellow-900">
          {text || <span className="italic text-yellow-600">Double-click to edit…</span>}
        </p>
      )}
    </div>
  );
});
