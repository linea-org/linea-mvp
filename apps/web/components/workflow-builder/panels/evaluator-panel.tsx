'use client';

import { useRef } from 'react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Textarea } from '@linea/ui/components/textarea';
import type { Node } from '@xyflow/react';
import { VariableChips } from '../variable-picker';
import { ModelPicker } from '../model-picker';

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
        <ModelPicker value={model} onChange={(v) => onUpdate({ model: v })} providerFilter="anthropic" />
        <p className="text-[10px] text-muted-foreground">Evaluator runs on Anthropic models only.</p>
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
      </div>

      <div className="space-y-1.5">
        <Label>Pass threshold</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={(data.passThreshold as number) ?? 0.6}
            onChange={(e) => onUpdate({ passThreshold: Math.min(1, Math.max(0, Number(e.target.value))) })}
            className="w-24 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Fraction 0–1. With range 0–10 and threshold 0.6: pass if score ≥ {((scoreMin + (scoreMax - scoreMin) * ((data.passThreshold as number) ?? 0.6))).toFixed(1)}.
          </p>
        </div>
      </div>
    </div>
  );
}
