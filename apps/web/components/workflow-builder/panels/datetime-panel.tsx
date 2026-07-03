"use client"

import { Label } from "@linea/ui/components/label"
import { Input } from "@linea/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"

interface DatetimePanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
}

const OPERATIONS = [
  { value: "now", label: "Now — current date/time" },
  { value: "format", label: "Format — convert to string" },
  { value: "parse", label: "Parse — extract components" },
  { value: "add", label: "Add — add duration" },
  { value: "subtract", label: "Subtract — subtract duration" },
  { value: "diff", label: "Diff — difference between dates" },
]

const UNITS = [
  "milliseconds",
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
]

const FORMAT_PRESETS = [
  { value: "ISO", label: "ISO 8601  (2025-01-15T10:30:00.000Z)" },
  { value: "YYYY-MM-DD", label: "Date only  (2025-01-15)" },
  { value: "YYYY-MM-DD HH:mm", label: "Date + time  (2025-01-15 10:30)" },
  { value: "MM/DD/YYYY", label: "US format  (01/15/2025)" },
  { value: "DD/MM/YYYY", label: "EU format  (15/01/2025)" },
  { value: "UNIX", label: "Unix timestamp" },
]

function FormatSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FORMAT_PRESETS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function DatetimePanel({ data, onUpdate }: DatetimePanelProps) {
  const op = (data.operation as string) ?? "now"

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Operation</Label>
        <Select value={op} onValueChange={(v) => onUpdate({ operation: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {op === "now" && (
        <div className="space-y-1.5">
          <Label>Output format</Label>
          <FormatSelect
            value={(data.format as string) ?? "ISO"}
            onValueChange={(v) => onUpdate({ format: v })}
          />
          <p className="text-[10px] text-muted-foreground">
            Returns: <code>iso</code>, <code>unix</code>, <code>formatted</code>
          </p>
        </div>
      )}

      {(op === "format" || op === "parse") && (
        <>
          <div className="space-y-1.5">
            <Label>Input variable</Label>
            <Input
              value={(data.input as string) ?? ""}
              onChange={(e) => onUpdate({ input: e.target.value })}
              placeholder="lastOutput or variable name"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Variable holding the date string or timestamp
            </p>
          </div>
          {op === "format" && (
            <div className="space-y-1.5">
              <Label>Output format</Label>
              <FormatSelect
                value={(data.format as string) ?? "ISO"}
                onValueChange={(v) => onUpdate({ format: v })}
              />
            </div>
          )}
          {op === "parse" && (
            <p className="text-[10px] text-muted-foreground">
              Returns: <code>iso</code>, <code>unix</code>, <code>year</code>,{" "}
              <code>month</code>, <code>day</code>, <code>hour</code>,{" "}
              <code>minute</code>, <code>second</code>, <code>weekday</code>
            </p>
          )}
        </>
      )}

      {(op === "add" || op === "subtract") && (
        <>
          <div className="space-y-1.5">
            <Label>Input variable</Label>
            <Input
              value={(data.input as string) ?? ""}
              onChange={(e) => onUpdate({ input: e.target.value })}
              placeholder="lastOutput or variable name"
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                value={(data.amount as number) ?? 1}
                onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
                min={0}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={(data.unit as string) ?? "days"}
                onValueChange={(v) => onUpdate({ unit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Output format</Label>
            <FormatSelect
              value={(data.format as string) ?? "ISO"}
              onValueChange={(v) => onUpdate({ format: v })}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Returns: <code>iso</code>, <code>unix</code>, <code>formatted</code>
          </p>
        </>
      )}

      {op === "diff" && (
        <>
          <div className="space-y-1.5">
            <Label>Date A (variable)</Label>
            <Input
              value={(data.dateA as string) ?? ""}
              onChange={(e) => onUpdate({ dateA: e.target.value })}
              placeholder="lastOutput or variable name"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date B (variable)</Label>
            <Input
              value={(data.dateB as string) ?? ""}
              onChange={(e) => onUpdate({ dateB: e.target.value })}
              placeholder="variable name (empty = now)"
              className="font-mono text-xs"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Returns B - A in: <code>milliseconds</code>, <code>seconds</code>,{" "}
            <code>minutes</code>, <code>hours</code>, <code>days</code>,{" "}
            <code>weeks</code>
          </p>
        </>
      )}
    </div>
  )
}
