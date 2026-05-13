'use client';

import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Robot01Icon,
  AiBrain01Icon,
  GitBranchIcon,
  Globe02Icon,
  Plug01Icon,
  CodeIcon,
  CheckmarkCircle01Icon,
  StickyNote01Icon,
  Download04Icon,
  Database01Icon,
  Shield01Icon,
  ComputerTerminal01Icon,
  RepeatIcon,
  WorkflowSquare01Icon,
  Message01Icon,
  SourceCodeSquareIcon,
  FileEditIcon,
  MailSend01Icon,
} from '@hugeicons/core-free-icons';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { cn } from '@linea/ui/lib/utils';

interface NodeDef {
  type: string;
  label: string;
  description: string;
  icon: IconSvgElement;
  color: string;
}

const categories: { label: string; nodes: NodeDef[] }[] = [
  {
    label: 'AI',
    nodes: [
      { type: 'agent',  label: 'Agent',  description: 'LLM-powered node',   icon: Robot01Icon,  color: '#3b82f6' },
      { type: 'memory', label: 'Memory', description: 'Read/write memory',  icon: AiBrain01Icon, color: '#a855f7' },
    ],
  },
  {
    label: 'Logic',
    nodes: [
      { type: 'if-else', label: 'If-Else', description: 'Conditional branch', icon: GitBranchIcon, color: '#f59e0b' },
      { type: 'router',  label: 'Router',  description: 'Multi-path routing',  icon: GitBranchIcon, color: '#ea580c' },
    ],
  },
  {
    label: 'Tools',
    nodes: [
      { type: 'http', label: 'HTTP',     description: 'Call external APIs',     icon: Globe02Icon, color: '#8b5cf6' },
      { type: 'mcp',  label: 'MCP Tool', description: 'Model Context Protocol', icon: Plug01Icon,  color: '#eab308' },
    ],
  },
  {
    label: 'Data',
    nodes: [
      { type: 'transform',  label: 'Transform',  description: 'Transform variables',  icon: CodeIcon,              color: '#7c3aed' },
      { type: 'extract',    label: 'Extract',    description: 'Scrape web content',    icon: Download04Icon,        color: '#0ea5e9' },
      { type: 'retriever',  label: 'Retriever',  description: 'Query knowledge base',  icon: Database01Icon,        color: '#10b981' },
      { type: 'approval',   label: 'Approval',   description: 'Human-in-the-loop',    icon: CheckmarkCircle01Icon, color: '#9ca3af' },
      { type: 'note',       label: 'Note',        description: 'Annotation',           icon: StickyNote01Icon,      color: '#ca8a04' },
    ],
  },
  {
    label: 'Safety',
    nodes: [
      { type: 'guardrails', label: 'Guardrails', description: 'PII / content safety',  icon: Shield01Icon,           color: '#ef4444' },
      { type: 'code',       label: 'Code',        description: 'Run JavaScript (vm)',   icon: ComputerTerminal01Icon, color: '#64748b' },
    ],
  },
  {
    label: 'Flow',
    nodes: [
      { type: 'loop',        label: 'Loop',        description: 'Iterate over an array',  icon: RepeatIcon,           color: '#0891b2' },
      { type: 'subworkflow', label: 'Sub-workflow', description: 'Call another workflow', icon: WorkflowSquare01Icon, color: '#7c3aed' },
    ],
  },
  {
    label: 'Integrations',
    nodes: [
      { type: 'slack',  label: 'Slack',  description: 'Send messages to Slack',   icon: Message01Icon,        color: '#4a154b' },
      { type: 'github', label: 'GitHub', description: 'Manage issues and PRs',    icon: SourceCodeSquareIcon, color: '#1f2328' },
      { type: 'notion', label: 'Notion', description: 'Read and write Notion',    icon: FileEditIcon,         color: '#37352f' },
      { type: 'gmail',  label: 'Gmail',  description: 'Send and read emails',     icon: MailSend01Icon,       color: '#ea4335' },
    ],
  },
];

function DraggableNode({ node }: { node: NodeDef }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('nodeType', node.type);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={cn(
        'flex cursor-grab items-center gap-2.5 rounded-md border border-border bg-background p-2',
        'transition-shadow hover:shadow-sm active:cursor-grabbing select-none',
      )}
    >
      <div
        className="flex size-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: node.color }}
      >
        <HugeiconsIcon icon={node.icon} className="size-3.5 text-white" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{node.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{node.description}</p>
      </div>
    </div>
  );
}

export function LibraryPanel() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Node Library
        </p>
        {categories.map((cat) => (
          <div key={cat.label} className="space-y-1">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
              {cat.label}
            </p>
            <div className="space-y-1">
              {cat.nodes.map((node) => (
                <DraggableNode key={node.type} node={node} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
