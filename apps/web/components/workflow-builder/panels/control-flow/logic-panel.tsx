'use client';

import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';

interface LogicPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function LogicPanel({ data, onUpdate }: LogicPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="logic-condition">Condition</Label>
        <Input
          id="logic-condition"
          value={(data.condition as string) ?? ''}
          onChange={(e) => onUpdate({ condition: e.target.value })}
          placeholder="e.g. lastOutput.score > 0.8"
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          jexl expression using <code className="font-mono">input</code>, <code className="font-mono">lastOutput</code>, <code className="font-mono">variables</code>
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logic-true-label">True branch label</Label>
        <Input
          id="logic-true-label"
          value={(data.trueLabel as string) ?? 'true'}
          onChange={(e) => onUpdate({ trueLabel: e.target.value })}
          placeholder="true"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logic-false-label">False branch label</Label>
        <Input
          id="logic-false-label"
          value={(data.falseLabel as string) ?? 'false'}
          onChange={(e) => onUpdate({ falseLabel: e.target.value })}
          placeholder="false"
        />
      </div>
    </div>
  );
}
