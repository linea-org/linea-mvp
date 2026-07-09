"use client"

import type { Node } from "@xyflow/react"
import { Input } from "@linea/ui/components/input"
import { Textarea } from "@linea/ui/components/textarea"
import { Label } from "@linea/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"
import type { HttpNodeConfig } from "@linea/shared/contracts"
import { useEffect, useState } from "react"

interface HttpPanelProps {
  data: Partial<HttpNodeConfig>
  onUpdate: (data: Partial<HttpNodeConfig>) => void
  nodes?: Node[]
  nodeId?: string
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

export function HttpPanel({ data, onUpdate }: HttpPanelProps) {
  const method = data.method ?? "GET"
  const url = data.url ?? ""
  const headersStr = JSON.stringify(data.headers ?? {}, null, 2)

  const [bodyText, setBodyText] = useState(() =>
    JSON.stringify(data.body ?? {}, null, 2)
  )

  useEffect(() => {
    setBodyText(JSON.stringify(data.body ?? {}, null, 2))
  }, [data.body])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[100px_1fr] items-end gap-2">
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select
            value={method}
            onValueChange={(v: HttpNodeConfig["method"]) =>
              onUpdate({ method: v })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="http-url">URL</Label>
          <Input
            id="http-url"
            type="text"
            value={url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://api.example.com/"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="http-headers">Headers (JSON)</Label>
        <Textarea
          id="http-headers"
          rows={4}
          value={headersStr}
          onChange={(e) => {
            const value = e.target.value
            setBodyText(value)

            try {
              onUpdate({ headers: JSON.parse(value) })
            } catch {
              // Ignore invalid JSON while typing
            }
          }}
          placeholder={'{\n  "Content-Type": "application/json"\n}'}
          className="resize-y font-mono text-[11px]"
        />
      </div>

      {method !== "GET" && method !== "DELETE" && (
        <div className="space-y-1.5">
          <Label htmlFor="http-body">Body (JSON)</Label>
          <Textarea
            id="http-body"
            rows={5}
            value={bodyText}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                onUpdate({ body: parsed })
              } catch {
                onUpdate({ body: e.target.value })
              }
            }}
            placeholder={'{\n  "key": "value"\n}'}
            className="resize-y font-mono text-[11px]"
          />
        </div>
      )}
    </div>
  )
}
