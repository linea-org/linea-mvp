'use client';

import { Textarea } from '@linea/ui/components/textarea';
import { Label } from '@linea/ui/components/label';

interface TransformPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function TransformPanel({ data, onUpdate }: TransformPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="transform-script">Transform Script</Label>
        <Textarea
          id="transform-script"
          rows={10}
          value={(data.transformScript as string) ?? ''}
          onChange={(e) => onUpdate({ transformScript: e.target.value })}
          placeholder={"// Use state.variables to access variables.\n// Return the transformed value.\nreturn state.variables.input;"}
          className="resize-y font-mono text-[11px]"
        />
      </div>
      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <p className="mb-1 font-semibold text-foreground">Hint</p>
        <p>
          Use <code className="rounded bg-border px-1 font-mono">state.variables</code> to access workflow variables. The return value becomes the node&apos;s output.
        </p>
      </div>
    </div>
  );
}
