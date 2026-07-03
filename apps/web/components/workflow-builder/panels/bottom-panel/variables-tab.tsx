'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CodeIcon, Copy01Icon } from '@hugeicons/core-free-icons';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import type { Node } from '@xyflow/react';
import type { NodeResult } from '../../workflow-builder.types';

export function VariablesTab({ nodes, nodeResults }: { nodes: Node[]; nodeResults: Record<string, NodeResult> }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const refs: Array<{ path: string; value?: unknown; source: string }> = [];

  const startNode = nodes.find((n) => n.type === 'start');
  if (startNode) {
    refs.push({ path: '{{trigger.input}}', source: 'Start' });
    const testInput = startNode.data.testInput as Record<string, unknown> | undefined;
    if (testInput) {
      for (const [k] of Object.entries(testInput)) {
        refs.push({ path: `{{trigger.input.${k}}}`, source: 'Start' });
      }
    }
  }

  for (const node of nodes) {
    if (node.type === 'start' || node.type === 'end' || node.type === 'note') continue;
    const name = (node.data.nodeName as string) ?? node.type ?? node.id;
    const result = nodeResults[node.id];
    refs.push({
      path: `{{${name}.output}}`,
      value: result?.output,
      source: name,
    });
    if (result?.error) {
      refs.push({ path: `{{${name}.error}}`, value: result.error, source: name });
    }
  }

  if (refs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <HugeiconsIcon icon={CodeIcon} className="size-6 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Add nodes to see available variable references.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        {refs.map(({ path, value, source }) => (
          <div key={path} className="group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <code className="text-[11px] font-mono text-violet-600 dark:text-violet-400 break-all">{path}</code>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">from {source}</span>
              </div>
              {value !== undefined && (
                <p className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </p>
              )}
            </div>
            <button
              onClick={() => copy(path)}
              title="Copy path"
              className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-foreground transition-all"
            >
              <HugeiconsIcon
                icon={Copy01Icon}
                className={`size-3 ${copied === path ? 'text-green-500' : ''}`}
              />
            </button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
