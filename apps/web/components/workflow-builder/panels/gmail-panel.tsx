'use client';

import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import { Textarea } from '@linea/ui/components/textarea';

interface GmailPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

export function GmailPanel({ data, onUpdate }: GmailPanelProps) {
  const action = (data.action as string) ?? 'send_email';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Action</Label>
        <Select value={action} onValueChange={(v) => onUpdate({ action: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send_email">Send email</SelectItem>
            <SelectItem value="list_emails">List emails</SelectItem>
            <SelectItem value="get_email">Get email by ID</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action === 'send_email' && (
        <>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input
              value={(data.to as string) ?? ''}
              onChange={(e) => onUpdate({ to: e.target.value })}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              value={(data.subject as string) ?? ''}
              onChange={(e) => onUpdate({ subject: e.target.value })}
              placeholder="Hello from Linea"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              value={(data.body as string) ?? ''}
              onChange={(e) => onUpdate({ body: e.target.value })}
              rows={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>CC <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={(data.cc as string) ?? ''}
                onChange={(e) => onUpdate({ cc: e.target.value })}
                placeholder="cc@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>BCC <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={(data.bcc as string) ?? ''}
                onChange={(e) => onUpdate({ bcc: e.target.value })}
                placeholder="bcc@example.com"
              />
            </div>
          </div>
        </>
      )}

      {action === 'list_emails' && (
        <>
          <div className="space-y-1.5">
            <Label>Query <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              value={(data.query as string) ?? ''}
              onChange={(e) => onUpdate({ query: e.target.value })}
              placeholder="in:inbox is:unread"
            />
            <p className="text-xs text-muted-foreground">Gmail search syntax.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Max results</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={(data.maxResults as string) ?? '10'}
              onChange={(e) => onUpdate({ maxResults: e.target.value })}
              className="w-24"
            />
          </div>
        </>
      )}

      {action === 'get_email' && (
        <div className="space-y-1.5">
          <Label>Message ID</Label>
          <Input
            value={(data.messageId as string) ?? ''}
            onChange={(e) => onUpdate({ messageId: e.target.value })}
            placeholder="18a4b2c3d4e5f678"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Token resolved from workspace secret <code>GMAIL_TOKEN</code> (OAuth2 access token).
      </p>
    </div>
  );
}
