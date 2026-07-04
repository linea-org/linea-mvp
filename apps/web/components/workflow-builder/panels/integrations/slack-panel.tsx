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

interface SlackPanelProps {
  data: Record<string, unknown>
  onUpdate: (fields: Record<string, unknown>) => void
  nodes?: Node[]
  nodeId?: string
}

export function SlackPanel({ data, onUpdate }: SlackPanelProps) {
  const action = (data.action as string) ?? "send_message"

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Action</Label>
        <Select value={action} onValueChange={(v) => onUpdate({ action: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send_message">
              Send message to channel
            </SelectItem>
            <SelectItem value="send_dm">Send direct message</SelectItem>
            <SelectItem value="list_channels">List channels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action === "send_message" && (
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Input
            value={(data.channel as string) ?? ""}
            onChange={(e) => onUpdate({ channel: e.target.value })}
            placeholder="#general or C0123ABCDEF"
          />
        </div>
      )}

      {action === "send_dm" && (
        <div className="space-y-1.5">
          <Label>User ID</Label>
          <Input
            value={(data.userId as string) ?? ""}
            onChange={(e) => onUpdate({ userId: e.target.value })}
            placeholder="U0123ABCDEF"
          />
        </div>
      )}

      {(action === "send_message" || action === "send_dm") && (
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea
            value={(data.message as string) ?? ""}
            onChange={(e) => onUpdate({ message: e.target.value })}
            placeholder="Hello from Linea!"
            rows={4}
          />
        </div>
      )}

      {action === "send_message" && (
        <div className="space-y-1.5">
          <Label>
            Bot name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            value={(data.username as string) ?? ""}
            onChange={(e) => onUpdate({ username: e.target.value })}
            placeholder="Linea Bot"
          />
        </div>
      )}

      {action === "send_message" && (
        <div className="space-y-1.5">
          <Label>
            Bot emoji <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            value={(data.iconEmoji as string) ?? ""}
            onChange={(e) => onUpdate({ iconEmoji: e.target.value })}
            placeholder=":robot_face:"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Token resolved from workspace secret <code>SLACK_TOKEN</code>.
      </p>
    </div>
  )
}
