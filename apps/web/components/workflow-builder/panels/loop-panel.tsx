'use client';

import { useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { VariableChips } from '../variable-picker';

interface LoopPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
  nodes?: Node[];
  edges?: Edge[];
  nodeId?: string;
}

export function LoopPanel({ data, onUpdate, nodes = [], edges = [], nodeId }: LoopPanelProps) {
  const arrayRef = useRef<HTMLInputElement>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const arrayPath = (data.arrayPath as string) ?? '';
  const itemTransform = (data.itemTransform as string) ?? '';
  const maxIterations = (data.maxIterations as number) ?? 100;
  const children = (data.children as string[]) ?? [];

  // Derive connected child node names from outgoing edges
  const childNodeNames = edges
    .filter((e) => e.source === nodeId)
    .map((e) => {
      const node = nodes.find((n) => n.id === e.target);
      return (node?.data?.nodeName as string) ?? (node?.data?.label as string) ?? node?.type ?? e.target;
    });

  // Union with children stored in data (may not match current edges yet)
  const displayNames = childNodeNames.length > 0
    ? childNodeNames
    : children.map((id) => {
        const node = nodes.find((n) => n.id === id);
        return (node?.data?.nodeName as string) ?? (node?.data?.label as string) ?? node?.type ?? id;
      });

  return (
    <div className="space-y-4">
      {/* Instructional callout */}
      <div className="rounded-md border border-blue-400/30 bg-blue-400/10 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-400">
        Connect nodes to this loop in the canvas — they will run for each item in the array.
      </div>

      {/* Connected child nodes */}
      {displayNames.length > 0 && (
        <div className="space-y-1.5">
          <Label>Child nodes</Label>
          <ul className="space-y-1">
            {displayNames.map((name, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5 text-xs font-mono text-foreground/80"
              >
                <span className="size-1.5 rounded-full bg-blue-400 shrink-0" />
                {name}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            These nodes execute in order for each item. Connect or disconnect them on the canvas.
          </p>
        </div>
      )}

      {/* Array path */}
      <div className="space-y-1.5">
        <Label>Array variable</Label>
        <Input
          ref={arrayRef}
          value={arrayPath}
          onChange={(e) => onUpdate({ arrayPath: e.target.value })}
          placeholder="items or {{start.items}}"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId ?? ''}
          value={arrayPath}
          onChange={(v) => onUpdate({ arrayPath: v })}
          fieldRef={arrayRef}
        />
        <p className="text-xs text-muted-foreground">
          Dot-path into workflow variables (e.g. <code>start.items</code>) or a <code>{'{{variable}}'}</code> chip.
        </p>
      </div>

      {/* Max iterations */}
      <div className="space-y-1.5">
        <Label>Max iterations</Label>
        <Input
          type="number"
          min={1}
          max={1000}
          value={maxIterations}
          onChange={(e) => onUpdate({ maxIterations: parseInt(e.target.value) || 100 })}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">Safety cap. Default 100.</p>
      </div>

      {/* Legacy transform — collapsed by default */}
      <div className="border-t border-border/40 pt-3">
        <button
          type="button"
          onClick={() => setLegacyOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className={`transition-transform ${legacyOpen ? 'rotate-90' : ''}`}>▶</span>
          Advanced / Legacy
        </button>
        {legacyOpen && (
          <div className="mt-3 space-y-1.5">
            <Label>
              Item transform <span className="text-muted-foreground">(legacy — ignored when child nodes are connected)</span>
            </Label>
            <Input
              value={itemTransform}
              onChange={(e) => onUpdate({ itemTransform: e.target.value })}
              placeholder="item.name"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              JEXL expression evaluated per element. Use <code>item</code> for the current element.
              Has no effect when child nodes are connected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
