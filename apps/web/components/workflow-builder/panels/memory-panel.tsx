"use client"

import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Textarea } from "@linea/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"

interface MemoryPanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  retrieve: "Query stored entries by keyword or key name.",
  write: "Explicitly save a key-value pair to memory.",
  delete: "Remove a specific key from memory.",
  clear: "Wipe all entries in the selected scope.",
}

export function MemoryPanel({ data, onUpdate }: MemoryPanelProps) {
  const mode = (data.memoryMode as string) ?? "retrieve"
  const scope = (data.memoryScope as string) ?? "thread"

  const showSessionKey = scope === "session"
  const showKey = mode === "write" || mode === "delete"
  const showValue = mode === "write"
  const showQuery = mode === "retrieve"

  return (
    <div className="space-y-4">
      {/* Mode */}
      <div className="space-y-1.5">
        <Label>Mode</Label>
        <Select value={mode} onValueChange={(v) => onUpdate({ memoryMode: v })}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="retrieve">Retrieve</SelectItem>
            <SelectItem value="write">Write</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="clear">Clear</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {MODE_DESCRIPTIONS[mode]}
        </p>
      </div>

      {/* Scope */}
      <div className="space-y-1.5">
        <Label>Scope</Label>
        <Select
          value={scope}
          onValueChange={(v) => onUpdate({ memoryScope: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thread">Thread — this conversation</SelectItem>
            <SelectItem value="workflow">
              Workflow — shared across all callers
            </SelectItem>
            <SelectItem value="session">
              Session — isolated per caller (B2B)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session key */}
      {showSessionKey && (
        <div className="space-y-1.5">
          <Label>Session Key</Label>
          <Input
            value={(data.memorySessionKey as string) ?? ""}
            onChange={(e) => onUpdate({ memorySessionKey: e.target.value })}
            placeholder="e.g. {{input.userId}}"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Expression that uniquely identifies the caller. Each distinct value
            gets its own isolated memory namespace.
          </p>
        </div>
      )}

      {/* Key — write / delete */}
      {showKey && (
        <div className="space-y-1.5">
          <Label>Key</Label>
          <Input
            value={(data.memoryKey as string) ?? ""}
            onChange={(e) => onUpdate({ memoryKey: e.target.value })}
            placeholder="e.g. userPreferences"
          />
        </div>
      )}

      {/* Value — write only */}
      {showValue && (
        <div className="space-y-1.5">
          <Label>Value</Label>
          <Textarea
            value={(data.memoryValue as string) ?? ""}
            onChange={(e) => onUpdate({ memoryValue: e.target.value })}
            placeholder={'e.g. {{agentOutput}} or {"theme":"dark"}'}
            className="min-h-[80px] font-mono text-xs"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Supports {"{{variable}}"} interpolation. JSON values are stored
            as-is.
          </p>
        </div>
      )}

      {/* Query — retrieve only */}
      {showQuery && (
        <>
          <div className="space-y-1.5">
            <Label>Query</Label>
            <Input
              value={(data.memoryQuery as string) ?? ""}
              onChange={(e) => onUpdate({ memoryQuery: e.target.value })}
              placeholder="e.g. {{userIntent}} or leave blank for all"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Top-K Results</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={(data.memoryTopK as number) ?? 5}
              onChange={(e) =>
                onUpdate({ memoryTopK: parseInt(e.target.value, 10) })
              }
              className="w-24"
            />
          </div>
        </>
      )}
    </div>
  )
}
