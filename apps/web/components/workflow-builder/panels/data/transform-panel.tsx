"use client"

import { Textarea } from "@linea/ui/components/textarea"
import { Label } from "@linea/ui/components/label"

interface TransformPanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
}

export function TransformPanel({ data, onUpdate }: TransformPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="transform-script">Transform Script</Label>
        <Textarea
          id="transform-script"
          rows={10}
          value={(data.transformScript as string) ?? ""}
          onChange={(e) => onUpdate({ transformScript: e.target.value })}
          placeholder={"input.score * 100"}
          className="resize-y font-mono text-[11px]"
        />
      </div>
      <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">
          Expression syntax (jexl)
        </p>
        <p>
          Available:{" "}
          <code className="rounded bg-border px-1 font-mono">input</code>,{" "}
          <code className="rounded bg-border px-1 font-mono">lastOutput</code>,{" "}
          <code className="rounded bg-border px-1 font-mono">variables</code>
        </p>
        <p>
          Examples:{" "}
          <code className="rounded bg-border px-1 font-mono">
            input.score + 1
          </code>{" "}
          &nbsp;·&nbsp;{" "}
          <code className="rounded bg-border px-1 font-mono">
            variables.name == &apos;foo&apos;
          </code>
        </p>
        <p className="text-[10px]">
          No <code className="font-mono">return</code> keyword — the whole
          expression is the output value.
        </p>
      </div>
    </div>
  )
}
