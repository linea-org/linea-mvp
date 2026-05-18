'use client';

import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ZapIcon, Square01Icon, Robot01Icon, Globe02Icon, CodeIcon, GitBranchIcon,
  CheckmarkCircle01Icon, Plug01Icon, AiBrain01Icon, StickyNote01Icon, Download04Icon,
  Database01Icon, Shield01Icon, ComputerTerminal01Icon, RepeatIcon, WorkflowSquare01Icon,
  Message01Icon, SourceCodeSquareIcon, FileEditIcon, MailSend01Icon, LayoutTable01Icon,
  Clock01Icon, VariableIcon, ChartEvaluationIcon, FilterIcon, GitMergeIcon, Calendar01Icon,
  LayoutTopIcon, LayoutLeftIcon, LockKeyIcon, SquareLock01Icon,
  ArrowDown01Icon, ArrowRight01Icon,
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
  transform: { icon: CodeIcon,              color: '#7c3aed' },
  'if-else': { icon: GitBranchIcon,         color: '#f59e0b' },
  router:    { icon: GitBranchIcon,         color: '#ea580c' },
  approval:  { icon: CheckmarkCircle01Icon, color: '#9ca3af' },
  mcp:       { icon: Plug01Icon,            color: '#eab308' },
  memory:    { icon: AiBrain01Icon,         color: '#a855f7' },
  extract:   { icon: Download04Icon,        color: '#0ea5e9' },
  retriever: { icon: Database01Icon,        color: '#10b981' },
  guardrails:  { icon: Shield01Icon,            color: '#ef4444' },
  code:        { icon: ComputerTerminal01Icon,  color: '#64748b' },
  loop:        { icon: RepeatIcon,              color: '#0891b2' },
  parallel:    { icon: LayoutTable01Icon,       color: '#6366f1' },
  wait:        { icon: Clock01Icon,             color: '#64748b' },
  variables:   { icon: VariableIcon,            color: '#059669' },
  evaluator:   { icon: ChartEvaluationIcon,     color: '#d97706' },
  subworkflow: { icon: WorkflowSquare01Icon,    color: '#7c3aed' },
  slack:       { icon: Message01Icon,           color: '#4a154b' },
  github:      { icon: SourceCodeSquareIcon,    color: '#1f2328' },
  notion:      { icon: FileEditIcon,            color: '#37352f' },
  gmail:       { icon: MailSend01Icon,          color: '#ea4335' },
  filter:      { icon: FilterIcon,              color: '#06b6d4' },
  merge:       { icon: GitMergeIcon,            color: '#8b5cf6' },
  datetime:    { icon: Calendar01Icon,          color: '#0d9488' },
};

/* ------------------------------------------------------------------ */
/*  Inline property extractor                                           */
/* ------------------------------------------------------------------ */
function fmt(v: unknown, max = 26): string {
  const s = String(v ?? '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function getNodeProperties(nodeType: string, data: Record<string, unknown>): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string } | null> = [];
  switch (nodeType) {
    case 'agent': {
      rows.push(data.model ? { key: 'model', value: fmt(data.model) } : null);
      const instr = (data.instructions as string) || (data.systemPrompt as string);
      rows.push(instr ? { key: 'prompt', value: fmt(instr, 22) } : null);
      const toolCount = Array.isArray(data.tools) ? (data.tools as unknown[]).length : 0;
      if (toolCount > 0) rows.push({ key: 'tools', value: String(toolCount) });
      else if (data.maxSteps) rows.push({ key: 'steps', value: String(data.maxSteps) });
      break;
    }
    case 'http':
      rows.push(data.method   ? { key: 'method', value: fmt(data.method)   } : null);
      rows.push(data.url      ? { key: 'url',    value: fmt(data.url, 22)  } : null);
      rows.push(data.authType ? { key: 'auth',   value: fmt(data.authType) } : null);
      break;
    case 'if-else':
      rows.push(data.condition ? { key: 'if', value: fmt(data.condition, 22) } : null);
      break;
    case 'router': {
      const r = (data.routes as Array<{ label: string }> | undefined) ?? [];
      rows.push(r.length > 0 ? { key: 'routes', value: String(r.length) } : null);
      break;
    }
    case 'code':       rows.push(data.language  ? { key: 'lang',    value: fmt(data.language)  } : null); break;
    case 'memory': {
      rows.push(data.memoryMode  ? { key: 'mode',  value: fmt(data.memoryMode)  } : null);
      rows.push(data.memoryScope ? { key: 'scope', value: fmt(data.memoryScope) } : null);
      break;
    }
    case 'mcp':
      rows.push(data.serverName ? { key: 'server', value: fmt(data.serverName) } : null);
      rows.push(data.toolName   ? { key: 'tool',   value: fmt(data.toolName)   } : null);
      break;
    case 'slack':
      rows.push(data.channel ? { key: 'channel', value: fmt(data.channel) } : null);
      rows.push(data.message ? { key: 'msg',     value: fmt(data.message) } : null);
      break;
    case 'gmail':
      rows.push(data.to      ? { key: 'to',      value: fmt(data.to)      } : null);
      rows.push(data.subject ? { key: 'subject', value: fmt(data.subject) } : null);
      break;
    case 'github':
      rows.push(data.action ? { key: 'action', value: fmt(data.action) } : null);
      rows.push(data.repo   ? { key: 'repo',   value: fmt(data.repo)   } : null);
      break;
    case 'notion':
      rows.push(data.action   ? { key: 'action', value: fmt(data.action)   } : null);
      rows.push(data.database ? { key: 'db',     value: fmt(data.database) } : null);
      break;
    case 'wait':        rows.push(data.duration   ? { key: 'wait',   value: `${fmt(data.duration)}s`    } : null); break;
    case 'loop':
      rows.push(data.maxIterations ? { key: 'max',  value: String(data.maxIterations) } : null);
      rows.push(data.arrayPath     ? { key: 'over', value: fmt(data.arrayPath, 20)    } : null);
      break;
    case 'evaluator':   rows.push(data.model      ? { key: 'model', value: fmt(data.model)       } : null); break;
    case 'retriever': {
      rows.push(data.knowledgeBaseId ? { key: 'kb', value: fmt(data.knowledgeBaseId, 12) } : null);
      rows.push(data.embeddingModel  ? { key: 'embed', value: fmt(data.embeddingModel, 20) } : null);
      break;
    }
    case 'extract':     rows.push(data.prompt     ? { key: 'prompt', value: fmt(data.prompt)     } : null); break;
    case 'approval':    rows.push(data.message    ? { key: 'prompt', value: fmt(data.message)    } : null); break;
    case 'guardrails': {
      const rl = (data.rules as Array<unknown> | undefined) ?? [];
      rows.push(rl.length > 0 ? { key: 'rules', value: String(rl.length) } : null);
      break;
    }
    case 'subworkflow': rows.push(data.workflowId ? { key: 'workflow', value: fmt(data.workflowId, 20) } : null); break;
    case 'parallel': {
      const b = (data.branches as Array<unknown> | undefined) ?? [];
      rows.push(b.length > 0 ? { key: 'branches', value: String(b.length) } : null);
      break;
    }
    case 'start':     rows.push(data.triggerType ? { key: 'trigger', value: fmt(data.triggerType) } : null); break;
    case 'transform': rows.push(data.expression  ? { key: 'expr',    value: fmt(data.expression, 22) } : null); break;
    case 'variables': {
      const v = (data.variables as Array<unknown> | undefined) ?? [];
      rows.push(v.length > 0 ? { key: 'vars', value: String(v.length) } : null);
      break;
    }
    case 'filter':
      rows.push(data.source    ? { key: 'source', value: fmt(data.source) }    : null);
      rows.push(data.condition ? { key: 'where',  value: fmt(data.condition) } : null);
      break;
    case 'merge': {
      const srcs = (data.sources as string[] | undefined) ?? [];
      rows.push(srcs.length > 0 ? { key: 'sources', value: String(srcs.length) } : null);
      rows.push(data.mode ? { key: 'mode', value: fmt(data.mode) } : null);
      break;
    }
    case 'datetime':
      rows.push(data.operation ? { key: 'op',     value: fmt(data.operation) } : null);
      rows.push(data.format    ? { key: 'format', value: fmt(data.format)    } : null);
      break;
  }
  return rows.filter((r): r is { key: string; value: string } => r !== null).slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  Status dot                                                          */
/* ------------------------------------------------------------------ */
function StatusDot({ status }: { status?: string }) {
  if (!status) return null;
  const cls =
    status === 'running'   ? 'size-2 rounded-full bg-orange-400 animate-pulse' :
    status === 'completed' ? 'size-2 rounded-full bg-green-500' :
    status === 'failed'    ? 'size-2 rounded-full bg-red-500' :
                             'size-2 rounded-full bg-muted-foreground';
  return <span className={cls} />;
}

/* ------------------------------------------------------------------ */
/*  Handle classes                                                      */
/* ------------------------------------------------------------------ */
const TARGET_CLS =
  '!size-3 !rounded-full !border-[2px] !border-muted-foreground/60 !bg-background ' +
  'hover:!border-foreground hover:!scale-125 transition-transform duration-150';
const SOURCE_CLS =
  '!size-3 !rounded-full !border-[2px] !border-background !bg-muted-foreground/70 ' +
  'hover:!bg-foreground hover:!scale-125 transition-transform duration-150';
const TRUE_CLS =
  '!size-3 !rounded-full !border-[2px] !border-background !bg-green-500 ' +
  'hover:!bg-green-600 hover:!scale-125 transition-transform duration-150';
const FALSE_CLS =
  '!size-3 !rounded-full !border-[2px] !border-background !bg-red-400 ' +
  'hover:!bg-red-500 hover:!scale-125 transition-transform duration-150';

/* ------------------------------------------------------------------ */
/*  Status ring map                                                     */
/* ------------------------------------------------------------------ */
const STATUS_RING: Record<string, { border: string; shadow: string; animate?: string }> = {
  running:   { border: 'rgb(59,130,246)',  shadow: '0 0 0 3px rgba(59,130,246,0.45)', animate: 'animate-pulse' },
  completed: { border: 'rgb(34,197,94)',   shadow: '0 0 0 2px rgba(34,197,94,0.55)'  },
  failed:    { border: 'rgb(239,68,68)',   shadow: '0 0 0 2px rgba(239,68,68,0.55)'  },
  suspended: { border: 'rgb(245,158,11)',  shadow: '0 0 0 2px rgba(245,158,11,0.55)' },
};

/* ------------------------------------------------------------------ */
/*  NodeShell                                                           */
/* ------------------------------------------------------------------ */
function NodeShell({
  nodeType, label, status, selected,
  properties, posLocked, delLocked,
  portsVertical, onTogglePorts,
  outputPreview,
  children,
}: {
  nodeType: string; label: string; status?: string; selected: boolean;
  properties: Array<{ key: string; value: string }>;
  posLocked: boolean; delLocked: boolean;
  portsVertical: boolean; onTogglePorts: () => void;
  outputPreview?: string;
  children?: React.ReactNode;
}) {
  const theme = themes[nodeType] ?? defaultTheme;
  const ring  = status ? STATUS_RING[status] : undefined;

  const borderColor = ring?.border ?? (selected ? theme.color : undefined);
  const boxShadow   = ring
    ? ring.shadow
    : selected
      ? `0 0 0 2px ${theme.color}33, 0 2px 8px rgba(0,0,0,.10)`
      : undefined;

  return (
    <div
      className={cn(
        'min-w-[176px] cursor-grab rounded-xl border bg-background shadow-sm select-none transition-shadow duration-300',
        selected && !ring ? 'shadow-md' : '',
        ring?.animate ?? '',
      )}
      style={{ borderColor: borderColor ?? 'hsl(var(--border))', boxShadow }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: theme.color }}>
          <HugeiconsIcon icon={theme.icon} className="size-3.5 text-white" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground leading-tight">{label}</p>
          {status ? (
            <div className="mt-0.5 flex items-center gap-1">
              <StatusDot status={status} />
              <span className="text-[10px] capitalize text-muted-foreground">{status}</span>
            </div>
          ) : (posLocked || delLocked) ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              {posLocked && <span title="Position locked"><HugeiconsIcon icon={LockKeyIcon}     className="size-2.5 text-amber-500" /></span>}
              {delLocked && <span title="Deletion locked"><HugeiconsIcon icon={SquareLock01Icon} className="size-2.5 text-red-400"  /></span>}
            </div>
          ) : null}
        </div>
        {/* Port-orientation toggle */}
        <button
          title={portsVertical ? 'Switch to horizontal ports' : 'Switch to vertical ports'}
          onClick={(e) => { e.stopPropagation(); onTogglePorts(); }}
          className={cn(
            'shrink-0 rounded p-0.5 transition-colors nodrag',
            portsVertical
              ? 'text-foreground bg-muted'
              : 'text-muted-foreground/50 hover:text-muted-foreground',
          )}
        >
          <HugeiconsIcon icon={portsVertical ? LayoutTopIcon : LayoutLeftIcon} className="size-3" />
        </button>
      </div>

      {/* Inline property chips */}
      {properties.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {properties.map(({ key, value }) => (
            <span
              key={key}
              title={`${key}: ${value}`}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 max-w-full"
            >
              <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/60 shrink-0">{key}</span>
              <span className="text-[9px] text-foreground/75 truncate font-mono">{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Output preview strip */}
      {outputPreview && (
        <div className="border-t border-border/40 mx-2.5 pt-1 pb-1.5">
          <p className="text-[9px] font-mono text-foreground/50 truncate" title={outputPreview}>{outputPreview}</p>
        </div>
      )}

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CustomNode                                                          */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Connection-rule helpers                                             */
/* ------------------------------------------------------------------ */

/** Nodes whose target handle accepts more than 1 incoming connection */
const MULTI_TARGET_NODES = new Set(['merge', 'end']);

/** Nodes that render their own branching source handles */
const BRANCHING_NODES = new Set(['if-else', 'approval', 'evaluator', 'guardrails']);

type BranchSide = { id: string; label: string; cls: string };

const BRANCH_DEFS: Record<string, [BranchSide, BranchSide]> = {
  'if-else':   [{ id: 'true',     label: 'T',        cls: TRUE_CLS  }, { id: 'false',    label: 'F',       cls: FALSE_CLS }],
  approval:    [{ id: 'approved', label: 'approved',  cls: TRUE_CLS  }, { id: 'rejected', label: 'rejected',cls: FALSE_CLS }],
  evaluator:   [{ id: 'passed',   label: 'passed',    cls: TRUE_CLS  }, { id: 'failed',   label: 'failed',  cls: FALSE_CLS }],
  guardrails:  [{ id: 'pass',     label: 'pass',      cls: TRUE_CLS  }, { id: 'block',    label: 'block',   cls: FALSE_CLS }],
};

export const CustomNode = memo(function CustomNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();

  const nodeType      = (data.nodeType      as string)  ?? 'agent';
  const label         = (data.nodeName      as string)  ?? (data.label as string) ?? nodeType;
  const status        = data.status         as string | undefined;
  const posLocked     = (data.positionLocked as boolean) ?? false;
  const delLocked     = (data.deleteLocked   as boolean) ?? false;
  const portsVertical = (data.portsVertical  as boolean) ?? false;
  const outputPreview = data._outputPreview  as string | undefined;

  const isBranching = BRANCHING_NODES.has(nodeType);
  const isRouter    = nodeType === 'router';
  const isMerge     = nodeType === 'merge';

  // For if-else: allow label overrides; other branching nodes use fixed labels
  const branchDef = BRANCH_DEFS[nodeType];
  const branchTrue  = branchDef
    ? (nodeType === 'if-else'
        ? { ...branchDef[0], label: (data.trueLabel  as string | undefined) || branchDef[0].label }
        : branchDef[0])
    : null;
  const branchFalse = branchDef
    ? (nodeType === 'if-else'
        ? { ...branchDef[1], label: (data.falseLabel as string | undefined) || branchDef[1].label }
        : branchDef[1])
    : null;

  const routes = isRouter
    ? ((data.routes as Array<{ id?: string; label: string }>) ?? []).map((r, i) => ({ ...r, id: r.id ?? `route-${i}` }))
    : [];

  const properties = getNodeProperties(nodeType, data as Record<string, unknown>);

  const inPos  = portsVertical ? Position.Top    : Position.Left;
  const outPos = portsVertical ? Position.Bottom : Position.Right;

  function togglePorts() {
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, portsVertical: !portsVertical } } : n,
    ));
  }

  return (
    <NodeShell
      nodeType={nodeType} label={label} status={status} selected={!!selected}
      properties={properties} posLocked={posLocked} delLocked={delLocked}
      portsVertical={portsVertical} onTogglePorts={togglePorts}
      outputPreview={outputPreview}
    >
      {/* Target handle */}
      <Handle type="target" position={inPos} className={TARGET_CLS} />

      {/* Source handles */}
      {isBranching && branchTrue && branchFalse ? (
        <>
          {portsVertical ? (
            <>
              <Handle type="source" position={Position.Bottom} id={branchTrue.id}  style={{ left: '30%' }} className={branchTrue.cls} />
              <span className="pointer-events-none absolute bottom-[-16px] text-[9px] font-bold uppercase tracking-wide text-green-600 select-none truncate max-w-12" style={{ left: 'calc(30% - 14px)' }}>{branchTrue.label}</span>
              <Handle type="source" position={Position.Bottom} id={branchFalse.id} style={{ left: '70%' }} className={branchFalse.cls} />
              <span className="pointer-events-none absolute bottom-[-16px] text-[9px] font-bold uppercase tracking-wide text-red-500 select-none truncate max-w-12" style={{ left: 'calc(70% - 14px)' }}>{branchFalse.label}</span>
            </>
          ) : (
            <>
              <Handle type="source" position={Position.Right} id={branchTrue.id}  style={{ top: '35%' }} className={branchTrue.cls} />
              <span className="pointer-events-none absolute right-[-4px] translate-x-full text-[9px] font-bold uppercase tracking-wide text-green-600 select-none truncate max-w-16" style={{ top: 'calc(35% - 6px)' }}>{branchTrue.label}</span>
              <Handle type="source" position={Position.Right} id={branchFalse.id} style={{ top: '65%' }} className={branchFalse.cls} />
              <span className="pointer-events-none absolute right-[-4px] translate-x-full text-[9px] font-bold uppercase tracking-wide text-red-500 select-none truncate max-w-16" style={{ top: 'calc(65% - 6px)' }}>{branchFalse.label}</span>
            </>
          )}
        </>
      ) : isRouter && routes.length > 0 ? (
        routes.map((route, i) => {
          const pct = ((i + 1) / (routes.length + 1)) * 100;
          if (portsVertical) {
            return (
              <React.Fragment key={route.id}>
                <Handle type="source" position={Position.Bottom} id={route.id} style={{ left: `${pct}%` }} className={SOURCE_CLS} />
                <span className="pointer-events-none absolute bottom-[-16px] text-[9px] font-medium text-muted-foreground select-none truncate max-w-12" style={{ left: `calc(${pct}% - 20px)` }}>
                  {route.label}
                </span>
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={route.id}>
              <Handle type="source" position={Position.Right} id={route.id} style={{ top: `${pct}%` }} className={SOURCE_CLS} />
              <span className="pointer-events-none absolute right-[-4px] translate-x-full text-[9px] font-medium text-muted-foreground select-none truncate max-w-16" style={{ top: `calc(${pct}% - 7px)` }}>
                {route.label}
              </span>
            </React.Fragment>
          );
        })
      ) : (
        <Handle type="source" position={outPos} className={SOURCE_CLS} />
      )}
    </NodeShell>
  );
});

/* ------------------------------------------------------------------ */
/*  StartNode                                                           */
/* ------------------------------------------------------------------ */
export const StartNode = memo(function StartNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const label         = (data.nodeName       as string)  ?? (data.label as string) ?? 'Start';
  const posLocked     = (data.positionLocked  as boolean) ?? false;
  const delLocked     = (data.deleteLocked    as boolean) ?? false;
  const portsVertical = (data.portsVertical   as boolean) ?? false;
  const outputPreview = data._outputPreview   as string | undefined;
  const properties    = getNodeProperties('start', data as Record<string, unknown>);
  const outPos        = portsVertical ? Position.Bottom : Position.Right;

  function togglePorts() {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, portsVertical: !portsVertical } } : n));
  }

  return (
    <NodeShell
      nodeType="start" label={label} selected={!!selected}
      properties={properties} posLocked={posLocked} delLocked={delLocked}
      portsVertical={portsVertical} onTogglePorts={togglePorts}
      outputPreview={outputPreview}
    >
      <Handle type="source" position={outPos} className={SOURCE_CLS} />
    </NodeShell>
  );
});

/* ------------------------------------------------------------------ */
/*  EndNode                                                             */
/* ------------------------------------------------------------------ */
export const EndNode = memo(function EndNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const label         = (data.nodeName       as string)  ?? (data.label as string) ?? 'End';
  const posLocked     = (data.positionLocked  as boolean) ?? false;
  const delLocked     = (data.deleteLocked    as boolean) ?? false;
  const portsVertical = (data.portsVertical   as boolean) ?? false;
  const inPos         = portsVertical ? Position.Top : Position.Left;

  function togglePorts() {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, portsVertical: !portsVertical } } : n));
  }

  return (
    <NodeShell
      nodeType="end" label={label} selected={!!selected}
      properties={[]} posLocked={posLocked} delLocked={delLocked}
      portsVertical={portsVertical} onTogglePorts={togglePorts}
    >
      {/* End accepts any number of incoming connections — multiple branches can converge here */}
      <Handle type="target" position={inPos} className={TARGET_CLS} />
    </NodeShell>
  );
});

/* ------------------------------------------------------------------ */
/*  FrameNode                                                           */
/* ------------------------------------------------------------------ */
const FRAME_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export const FrameNode = memo(function FrameNode({ id, data, selected }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState((data.frameName as string) ?? 'Group');
  const labelInputRef = useRef<HTMLInputElement>(null);

  const label = (data.frameName as string) ?? 'Group';
  const collapsed = (data.collapsed as boolean) ?? false;
  const color = (data.frameColor as string) ?? '#6366f1';

  useEffect(() => { if (editingLabel) labelInputRef.current?.focus(); }, [editingLabel]);

  function toggleCollapse() {
    const nowCollapsed = !collapsed;
    let childIds: Set<string> = new Set();

    setNodes((nds) => {
      childIds = new Set(nds.filter((n) => n.parentId === id).map((n) => n.id));
      return nds.map((n) => {
        if (n.id === id) {
          const currentH = typeof n.style?.height === 'number' ? n.style.height : 220;
          return {
            ...n,
            style: {
              ...(n.style ?? {}),
              height: nowCollapsed ? 40 : ((n.data.expandedHeight as number) ?? 220),
            },
            data: {
              ...n.data,
              collapsed: nowCollapsed,
              expandedHeight: nowCollapsed ? currentH : currentH,
            },
          };
        }
        if (n.parentId === id) {
          return { ...n, hidden: nowCollapsed };
        }
        return n;
      });
    });

    // Hide/show edges connected to child nodes so they don't orphan on the canvas
    setEdges((eds) =>
      eds.map((e) =>
        childIds.has(e.source) || childIds.has(e.target)
          ? { ...e, hidden: nowCollapsed }
          : e,
      ),
    );
  }

  function commitLabel() {
    setEditingLabel(false);
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, frameName: labelValue } } : n));
  }

  function handleResize(_: unknown, { width, height }: { width: number; height: number }) {
    setNodes((nds) => nds.map((n) =>
      n.id === id
        ? { ...n, style: { ...(n.style ?? {}), width, height }, data: { ...n.data, expandedHeight: height } }
        : n,
    ));
  }

  return (
    <div
      className={cn('rounded-xl border-2 select-none overflow-hidden')}
      style={{
        borderColor: selected ? color : `${color}55`,
        backgroundColor: `${color}09`,
        width: '100%',
        height: '100%',
        minHeight: 40,
      }}
    >
      <NodeResizer
        minWidth={160}
        minHeight={80}
        isVisible={selected && !collapsed}
        lineStyle={{ borderColor: color, opacity: 0.5 }}
        handleStyle={{ backgroundColor: 'white', borderColor: color, width: 8, height: 8, borderRadius: 2 }}
        onResize={handleResize}
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <button
          onClick={toggleCollapse}
          className="nodrag shrink-0 rounded p-0.5 transition-colors hover:bg-black/10"
        >
          <HugeiconsIcon
            icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
            className="size-3"
            style={{ color }}
          />
        </button>

        {editingLabel ? (
          <input
            ref={labelInputRef}
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitLabel(); }}
            className="nodrag flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none border-b"
            style={{ color, borderColor: color }}
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate text-xs font-semibold cursor-text"
            style={{ color }}
            onDoubleClick={() => { setLabelValue(label); setEditingLabel(true); }}
          >
            {label}
          </span>
        )}

        {/* Color picker — only when selected */}
        {selected && !editingLabel && (
          <div className="nodrag flex items-center gap-0.5">
            {FRAME_COLORS.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, frameColor: c } } : n))}
                className={cn(
                  'size-2.5 rounded-full border transition-transform hover:scale-125',
                  c === color ? 'border-white scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  NoteNode                                                            */
/* ------------------------------------------------------------------ */
export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState((data.noteText as string) ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

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
