'use client';

import type { Node } from '@xyflow/react';

interface VariableChipsProps {
  nodes: Node[];
  currentNodeId?: string;
  value: string;
  onChange: (v: string) => void;
  fieldRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}

export function VariableChips({
  nodes,
  currentNodeId,
  value,
  onChange,
  fieldRef,
}: VariableChipsProps) {
  const candidates = nodes.filter(
    (n) => n.id !== currentNodeId && n.type !== 'note' && n.type !== 'end',
  );
  if (candidates.length === 0) return null;

  function insert(expr: string) {
    const el = fieldRef?.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + expr + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + expr.length;
        el.focus();
      });
    } else {
      onChange(value + expr);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1.5">
      <span className="shrink-0 text-[10px] text-muted-foreground">Insert:</span>
      {candidates.map((n) => {
        const name =
          (n.data?.nodeName as string) ||
          (n.data?.label as string) ||
          n.type ||
          n.id;
        const expr = `{{${name}}}`;
        return (
          <button
            key={n.id}
            type="button"
            title={`Insert ${expr}`}
            onClick={() => insert(expr)}
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-colors cursor-pointer"
          >
            {expr}
          </button>
        );
      })}
    </div>
  );
}
