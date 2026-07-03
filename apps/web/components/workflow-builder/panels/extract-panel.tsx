"use client"

import { useRef } from "react"
import type { Node } from "@xyflow/react"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"
import { VariableChips } from "../variable-picker"

interface ExtractPanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
  nodes?: Node[]
  nodeId?: string
}

const OUTPUT_OPTIONS = [
  { value: "text", label: "Text only" },
  { value: "markdown", label: "Markdown" },
  { value: "full", label: "Full response (all fields)" },
]

export function ExtractPanel({
  data,
  onUpdate,
  nodes = [],
  nodeId,
}: ExtractPanelProps) {
  const urlRef = useRef<HTMLInputElement>(null)
  const url = (data.url as string) ?? ""

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="extract-url">URL</Label>
        <Input
          ref={urlRef}
          id="extract-url"
          value={url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://example.com or {{input.url}}"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId}
          value={url}
          onChange={(v) => onUpdate({ url: v })}
          fieldRef={urlRef}
        />
        <p className="text-[11px] text-muted-foreground">
          Supports variable substitution. Uses Firecrawl if API key is
          configured, otherwise native fetch.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Output format</Label>
        <Select
          value={(data.outputFormat as string) ?? "text"}
          onValueChange={(v) => onUpdate({ outputFormat: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          <strong>Full response</strong> includes title, url, html, text, and
          markdown fields.
        </p>
      </div>
    </div>
  )
}
