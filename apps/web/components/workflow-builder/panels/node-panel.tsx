'use client';

import { useState, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
import type { Node } from '@xyflow/react';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { Separator } from '@linea/ui/components/separator';
import { AgentPanel } from './agent-panel';
import { HttpPanel } from './http-panel';
import { TransformPanel } from './transform-panel';
import { LogicPanel } from './logic-panel';
import { StartPanel } from './start-panel';
import { ApprovalPanel } from './approval-panel';
import { McpPanel } from './mcp-panel';
import { MemoryPanel } from './memory-panel';
import { ExtractPanel } from './extract-panel';
import { RetrieverPanel } from './retriever-panel';
import { GuardrailsPanel } from './guardrails-panel';
import { CodePanel } from './code-panel';
import { LoopPanel } from './loop-panel';
import { SubworkflowPanel } from './subworkflow-panel';
import { SlackPanel } from './slack-panel';
import { GitHubPanel } from './github-panel';
import { NotionPanel } from './notion-panel';
import { GmailPanel } from './gmail-panel';

interface NodePanelProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  nodes: Node[];
}

const nodeTypeLabels: Record<string, string> = {
  start:        'Start',
  end:          'End',
  agent:        'Agent',
  http:         'HTTP Request',
  transform:    'Transform',
  'if-else':    'If-Else',
  router:       'Router',
  approval:     'Approval',
  mcp:          'MCP Tool',
  memory:       'Memory',
  extract:      'Extract',
  retriever:    'Retriever',
  guardrails:   'Guardrails',
  code:         'Code',
  loop:         'Loop',
  subworkflow:  'Sub-workflow',
  slack:        'Slack',
  github:       'GitHub',
  notion:       'Notion',
  gmail:        'Gmail',
  note:         'Note',
};

const nodeTypeColors: Record<string, string> = {
  start:        '#6366f1',
  end:          '#14b8a6',
  agent:        '#3b82f6',
  http:         '#8b5cf6',
  transform:    '#7c3aed',
  'if-else':    '#f59e0b',
  router:       '#ea580c',
  approval:     '#9ca3af',
  mcp:          '#eab308',
  memory:       '#a855f7',
  extract:      '#0ea5e9',
  retriever:    '#10b981',
  guardrails:   '#ef4444',
  code:         '#64748b',
  loop:         '#0891b2',
  subworkflow:  '#7c3aed',
  slack:        '#4a154b',
  github:       '#1f2328',
  notion:       '#37352f',
  gmail:        '#ea4335',
  note:         '#ca8a04',
};

export function NodePanel({ node, onClose, onUpdate, onDelete, nodes }: NodePanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (node) setLocalName((node.data.nodeName as string) ?? (node.data.label as string) ?? '');
    setEditingName(false);
  }, [node?.id]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  if (!node) return null;

  const nodeType = (node.data.nodeType as string) ?? node.type ?? 'agent';
  const typeLabel = nodeTypeLabels[nodeType] ?? nodeType;
  const badgeColor = nodeTypeColors[nodeType] ?? '#6366f1';
  const nodeData = node.data as Record<string, unknown>;

  function commitName() {
    const trimmed = localName.trim();
    if (trimmed) onUpdate(node!.id, { nodeName: trimmed });
    setEditingName(false);
  }

  function handleUpdate(fields: Record<string, unknown>) {
    onUpdate(node!.id, fields);
  }

  function renderSubPanel() {
    switch (nodeType) {
      case 'agent':    return <AgentPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'http':     return <HttpPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'transform':return <TransformPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'if-else':
      case 'router':   return <LogicPanel data={nodeData} nodeType={nodeType} onUpdate={handleUpdate} />;
      case 'start':    return <StartPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'approval': return <ApprovalPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'mcp':        return <McpPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'memory':     return <MemoryPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'extract':    return <ExtractPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'retriever':  return <RetrieverPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'guardrails':   return <GuardrailsPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'code':         return <CodePanel data={nodeData} onUpdate={handleUpdate} />;
      case 'loop':         return <LoopPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'subworkflow':  return <SubworkflowPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'slack':        return <SlackPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'github':       return <GitHubPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'notion':       return <NotionPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'gmail':        return <GmailPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'note':       return <p className="text-xs text-muted-foreground">Double-click the note on the canvas to edit its text.</p>;
      case 'end':        return <p className="text-xs text-muted-foreground">The End node marks workflow termination. No configuration needed.</p>;
      default:           return null;
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: badgeColor }}
          >
            {typeLabel}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="destructive"
              title="Delete node"
              onClick={() => { onDelete(node.id); onClose(); }}
            >
              <HugeiconsIcon icon={Delete01Icon} />
            </Button>
            <Button size="icon-sm" variant="ghost" title="Close" onClick={onClose}>
              <HugeiconsIcon icon={Cancel01Icon} />
            </Button>
          </div>
        </div>

        {editingName ? (
          <Input
            ref={nameInputRef}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="h-7 text-sm font-semibold"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            title="Click to rename"
            className="block w-full truncate text-left text-sm font-semibold text-foreground hover:text-muted-foreground cursor-text"
          >
            {localName || typeLabel}
          </button>
        )}
      </div>

      <Separator />

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {renderSubPanel()}
        </div>
      </ScrollArea>
    </div>
  );
}
