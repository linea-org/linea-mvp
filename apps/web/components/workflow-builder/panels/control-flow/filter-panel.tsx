"use client"

import { Textarea } from "@linea/ui/components/textarea"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"

interface FilterPanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
}

export function FilterPanel({ data, onUpdate }: FilterPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-source">Source</Label>
        <Input
          id="filter-source"
          value={(data.source as string) ?? ""}
          onChange={(e) => onUpdate({ source: e.target.value })}
          placeholder="lastOutput  or  myArray"
          className="font-mono text-[11px]"
        />
        <p className="text-[11px] text-muted-foreground">
          Variable name holding the array to filter. Defaults to{" "}
          <code className="rounded bg-muted px-1 font-mono">lastOutput</code>.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-condition">Condition</Label>
        <Textarea
          id="filter-condition"
          rows={4}
          value={(data.condition as string) ?? ""}
          onChange={(e) => onUpdate({ condition: e.target.value })}
          placeholder={'item.status == "active"'}
          className="resize-y font-mono text-[11px]"
        />
        <p className="text-[11px] text-muted-foreground">
          Jexl expression evaluated per item. Use{" "}
          <code className="rounded bg-muted px-1 font-mono">item</code> for the
          current element and{" "}
          <code className="rounded bg-muted px-1 font-mono">index</code> for its
          position.
        </p>
      </div>

      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <p className="mb-1 font-semibold text-foreground">Examples</p>
        <pre className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
          {`item.active == true\nitem.score > 0.8\nindex < 5\nitem.type == "admin"`}
        </pre>
      </div>
    </div>
  )
}
