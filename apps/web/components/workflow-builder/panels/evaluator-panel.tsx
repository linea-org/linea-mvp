'use client';

import { useRef } from 'react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Textarea } from '@linea/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import type { Node } from '@xyflow/react';
import { VariableChips } from '../variable-picker';

const EVALUATOR_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (fast, cheap)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet (balanced)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

interface EvaluatorPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

export function EvaluatorPanel({ data, onUpdate, nodes = [], nodeId }: EvaluatorPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const model = (data.model as string) ?? 'claude-haiku-4-5-20251001';
  const criteria = (data.criteria as string) ?? '';
  const input = (data.input as string) ?? '';
  const scoreMin = (data.scoreMin as number) ?? 0;
  const scoreMax = (data.scoreMax as number) ?? 10;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Model</Label>
        <Select value={model} onValueChange={(v) => onUpdate({ model: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVALUATOR_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Evaluation criteria <span className="text-destructive">*</span></Label>
        <Textarea
          value={criteria}
          onChange={(e) => onUpdate({ criteria: e.target.value })}
          placeholder="Describe what makes a good response. E.g. 'The answer is factually accurate, concise, and addresses the user's question directly.'"
          rows={4}
          className="text-sm resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Input to evaluate <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => onUpdate({ input: e.target.value })}
          placeholder="Defaults to {{lastOutput}}"
          className="font-mono text-xs"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId ?? ''}
          value={input}
          onChange={(v) => onUpdate({ input: v })}
          fieldRef={inputRef}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Score range</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Min</p>
            <Input
              type="number"
              value={scoreMin}
              onChange={(e) => onUpdate({ scoreMin: Number(e.target.value) })}
            />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Max</p>
            <Input
              type="number"
              value={scoreMax}
              onChange={(e) => onUpdate({ scoreMax: Number(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Pass threshold = 60% of range (e.g. 6/10).</p>
      </div>
    </div>
  );
}
