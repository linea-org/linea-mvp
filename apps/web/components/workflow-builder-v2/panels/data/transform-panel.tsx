"use client"

import { Textarea } from "@linea/ui/components/textarea"
import { Label } from "@linea/ui/components/label"
import type { TransformNodeConfig } from "@linea/shared/contracts"
import { useEffect, useState } from "react"

interface TransformPanelProps {
  data: Partial<TransformNodeConfig>
  onUpdate: (data: Partial<TransformNodeConfig>) => void
}

export function TransformPanel({ data, onUpdate }: TransformPanelProps) {
  const [variablesText, setVariablesText] = useState(() =>
    JSON.stringify(data.variables ?? {}, null, 2)
  )

  useEffect(() => {
    setVariablesText(JSON.stringify(data.variables ?? {}, null, 2))
  }, [data.variables])

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="transform-variables">Variables (JSON)</Label>

        <Textarea
          id="transform-variables"
          rows={10}
          value={variablesText}
          onChange={(e) => {
            const value = e.target.value
            setVariablesText(value)

            try {
              onUpdate({
                variables: JSON.parse(value),
              })
            } catch {
              // Allow invalid JSON while editing.
            }
          }}
          placeholder={`{
  "outputValue": "input.score * 100"
}`}
          className="resize-y font-mono text-[11px]"
        />
      </div>

      <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Variables JSON Object</p>

        <p>
          Define the keys you want to output, and set their values to Jexl
          expressions.
        </p>

        <p>
          Available contexts:{" "}
          <code className="rounded bg-border px-1 font-mono">input</code>,{" "}
          <code className="rounded bg-border px-1 font-mono">lastOutput</code>,{" "}
          <code className="rounded bg-border px-1 font-mono">variables</code>
        </p>
      </div>
    </div>
  )
}
