"use client"

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
import { Textarea } from "@linea/ui/components/textarea"

interface NotionPanelProps {
  data: Record<string, unknown>
  onUpdate: (fields: Record<string, unknown>) => void
  nodes?: Node[]
  nodeId?: string
}

export function NotionPanel({ data, onUpdate }: NotionPanelProps) {
  const action = (data.action as string) ?? "create_page"

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Action</Label>
        <Select value={action} onValueChange={(v) => onUpdate({ action: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create_page">Create page</SelectItem>
            <SelectItem value="append_block">Append block</SelectItem>
            <SelectItem value="query_database">Query database</SelectItem>
            <SelectItem value="get_page">Get page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(action === "create_page" || action === "query_database") && (
        <div className="space-y-1.5">
          <Label>Database ID</Label>
          <Input
            value={(data.databaseId as string) ?? ""}
            onChange={(e) => onUpdate({ databaseId: e.target.value })}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>
      )}

      {(action === "append_block" || action === "get_page") && (
        <div className="space-y-1.5">
          <Label>Page ID</Label>
          <Input
            value={(data.pageId as string) ?? ""}
            onChange={(e) => onUpdate({ pageId: e.target.value })}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>
      )}

      {action === "create_page" && (
        <div className="space-y-1.5">
          <Label>
            Title <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            value={(data.title as string) ?? ""}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Page title"
          />
        </div>
      )}

      {(action === "create_page" || action === "append_block") && (
        <div className="space-y-1.5">
          <Label>
            Content <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            value={(data.content as string) ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            rows={4}
          />
        </div>
      )}

      {action === "query_database" && (
        <div className="space-y-1.5">
          <Label>
            Filter{" "}
            <span className="text-muted-foreground">(optional JSON)</span>
          </Label>
          <Textarea
            value={(data.filter as string) ?? ""}
            onChange={(e) => onUpdate({ filter: e.target.value })}
            placeholder='{"property":"Status","select":{"equals":"Done"}}'
            className="font-mono text-xs"
            rows={4}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Token resolved from workspace secret <code>NOTION_TOKEN</code>.
      </p>
    </div>
  )
}
