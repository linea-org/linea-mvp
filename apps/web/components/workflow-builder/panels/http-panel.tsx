"use client"

import { useRef } from "react"
import type { Node } from "@xyflow/react"
import { Input } from "@linea/ui/components/input"
import { Textarea } from "@linea/ui/components/textarea"
import { Label } from "@linea/ui/components/label"
import { Switch } from "@linea/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"
import { VariableChips } from "../variable-picker"

interface HttpPanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
  nodes?: Node[]
  nodeId?: string
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

export function HttpPanel({
  data,
  onUpdate,
  nodes = [],
  nodeId,
}: HttpPanelProps) {
  const method = (data.method as string) ?? "GET"
  const url = (data.url as string) ?? ""
  const body = (data.body as string) ?? ""
  const authType = (data.authType as string) ?? "none"
  const stripHtml = (data.stripHtml as boolean) ?? false
  const maxChars = data.maxChars as number | undefined
  const urlRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[100px_1fr] items-end gap-2">
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => onUpdate({ method: v })}>
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
            ref={urlRef}
            id="http-url"
            type="text"
            value={url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://api.example.com/{{endpoint}}"
          />
        </div>
      </div>

      <VariableChips
        nodes={nodes}
        currentNodeId={nodeId}
        value={url}
        onChange={(v) => onUpdate({ url: v })}
        fieldRef={urlRef}
      />

      {/* Auth */}
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label>Authentication</Label>
          <Select
            value={authType}
            onValueChange={(v) => onUpdate({ authType: v, authToken: "" })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer token</SelectItem>
              <SelectItem value="api-key">API key (X-API-Key)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {authType !== "none" && (
          <div className="space-y-1.5">
            <Label htmlFor="http-auth-token">
              {authType === "bearer" ? "Token" : "API Key"}
            </Label>
            <Input
              id="http-auth-token"
              type="password"
              value={(data.authToken as string) ?? ""}
              onChange={(e) => onUpdate({ authToken: e.target.value })}
              placeholder={
                authType === "bearer"
                  ? "{{variables.bearerToken}}"
                  : "{{variables.apiKey}}"
              }
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="http-headers">Headers (JSON)</Label>
        <Textarea
          id="http-headers"
          rows={4}
          value={(data.headers as string) ?? ""}
          onChange={(e) => onUpdate({ headers: e.target.value })}
          placeholder={'{\n  "Content-Type": "application/json"\n}'}
          className="resize-y font-mono text-[11px]"
        />
      </div>

      {method !== "GET" && method !== "DELETE" && (
        <div className="space-y-1.5">
          <Label htmlFor="http-body">Body (JSON)</Label>
          <Textarea
            ref={bodyRef}
            id="http-body"
            rows={5}
            value={body}
            onChange={(e) => onUpdate({ body: e.target.value })}
            placeholder={'{\n  "key": "{{value}}"\n}'}
            className="resize-y font-mono text-[11px]"
          />
          <VariableChips
            nodes={nodes}
            currentNodeId={nodeId}
            value={body}
            onChange={(v) => onUpdate({ body: v })}
            fieldRef={bodyRef}
          />
        </div>
      )}

      {/* Response processing */}
      <div className="space-y-3 border-t pt-3">
        <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Response
        </Label>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Strip HTML</p>
            <p className="text-[11px] text-muted-foreground">
              Extract plain text from HTML responses — removes tags, scripts,
              and styles. Recommended when passing web pages to an AI node.
            </p>
          </div>
          <Switch
            checked={stripHtml}
            onCheckedChange={(v) => onUpdate({ stripHtml: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="http-max-chars">Character limit</Label>
          <Input
            id="http-max-chars"
            type="number"
            min={100}
            step={1000}
            value={maxChars ?? ""}
            onChange={(e) =>
              onUpdate({
                maxChars: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="No limit (e.g. 8000)"
            className="text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Truncate the response body to this many characters before passing to
            the next node. Useful for keeping AI context small.
          </p>
        </div>
      </div>
    </div>
  )
}
