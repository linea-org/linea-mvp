"use client"

import type { Node } from "@xyflow/react"
import { Textarea } from "@linea/ui/components/textarea"
import { Label } from "@linea/ui/components/label"
import { Input } from "@linea/ui/components/input"
import { ModelPicker } from "../../model-picker"
import type { AgentNodeConfig } from "@linea/shared/contracts"

interface AgentPanelProps {
  data: Partial<AgentNodeConfig>
  onUpdate: (data: Partial<AgentNodeConfig>) => void
  nodes?: Node[]
  nodeId?: string
}

export function AgentPanel({ data, onUpdate }: AgentPanelProps) {
  const provider = data.provider ?? "anthropic"
  const model = data.model ?? "claude-sonnet-4-6"
  const systemPrompt = data.systemPrompt ?? ""
  const temperature = data.temperature ?? 0.7
  const maxTokens = data.maxTokens ?? 4096
  // Stringified JSON for arrays to allow simple editing in the builder
  const toolsStr = JSON.stringify(data.tools ?? [], null, 2)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Provider</Label>
        <Input
          value={provider}
          onChange={(e) => onUpdate({ provider: e.target.value as any })}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Model</Label>
        <ModelPicker
          value={model}
          onValueChange={(v) => onUpdate({ model: v })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-system">System Prompt</Label>
        <Textarea
          id="agent-system"
          rows={3}
          value={systemPrompt}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant…"
          className="resize-y font-sans text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="agent-temp" className="text-[10px]">
            Temperature
          </Label>
          <Input
            id="agent-temp"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) =>
              onUpdate({ temperature: parseFloat(e.target.value) })
            }
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="agent-maxtokens" className="text-[10px]">
            Max Tokens
          </Label>
          <Input
            id="agent-maxtokens"
            type="number"
            min={256}
            max={128000}
            step={256}
            value={maxTokens}
            onChange={(e) =>
              onUpdate({ maxTokens: parseInt(e.target.value) || 4096 })
            }
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tools (JSON array)</Label>
        <Textarea
          rows={4}
          value={toolsStr}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              onUpdate({ tools: parsed })
            } catch {
              // Ignore invalid JSON while typing
            }
          }}
          className="resize-y font-mono text-[11px]"
        />
      </div>
    </div>
  )
}
