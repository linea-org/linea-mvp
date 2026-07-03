'use client';

import { useRef } from 'react';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import type { Node } from '@xyflow/react';
import { VariableChips } from '../../variable-picker';

interface VariableEntry {
  key: string;
  value: string;
}

interface VariablesPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

export function VariablesPanel({ data, onUpdate, nodes = [], nodeId }: VariablesPanelProps) {
  const variables = (data.variables as VariableEntry[]) ?? [];
  const valueRefs = useRef<(HTMLInputElement | null)[]>([]);

  function addRow() {
    onUpdate({ variables: [...variables, { key: '', value: '' }] });
  }

  function updateRow(index: number, field: 'key' | 'value', val: string) {
    const next = variables.map((v, i) => (i === index ? { ...v, [field]: val } : v));
    onUpdate({ variables: next });
  }

  function removeRow(index: number) {
    onUpdate({ variables: variables.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Variables</Label>
        <p className="text-xs text-muted-foreground">
          Values support <code>{'{{variable}}'}</code> substitution. JSON values are parsed automatically.
        </p>

        {variables.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No variables defined. Click Add to create one.</p>
        )}

        {variables.map((entry, i) => (
          <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="key"
                value={entry.key}
                onChange={(e) => updateRow(i, 'key', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                ×
              </Button>
            </div>
            <Input
              ref={(el) => { valueRefs.current[i] = el; }}
              placeholder="value or {{variable}}"
              value={entry.value}
              onChange={(e) => updateRow(i, 'value', e.target.value)}
              className="font-mono text-xs"
            />
            <VariableChips
              nodes={nodes}
              currentNodeId={nodeId ?? ''}
              value={entry.value}
              onChange={(v) => updateRow(i, 'value', v)}
              fieldRef={{ current: valueRefs.current[i] ?? null }}
            />
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addRow} className="w-full">
          + Add variable
        </Button>
      </div>
    </div>
  );
}
