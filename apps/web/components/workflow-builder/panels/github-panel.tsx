'use client';

import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import { Textarea } from '@linea/ui/components/textarea';

interface GitHubPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

export function GitHubPanel({ data, onUpdate }: GitHubPanelProps) {
  const action = (data.action as string) ?? 'create_issue';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Action</Label>
        <Select value={action} onValueChange={(v) => onUpdate({ action: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create_issue">Create issue</SelectItem>
            <SelectItem value="comment_issue">Comment on issue</SelectItem>
            <SelectItem value="list_issues">List issues</SelectItem>
            <SelectItem value="create_pr">Create pull request</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Owner</Label>
          <Input
            value={(data.owner as string) ?? ''}
            onChange={(e) => onUpdate({ owner: e.target.value })}
            placeholder="acme-inc"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Repo</Label>
          <Input
            value={(data.repo as string) ?? ''}
            onChange={(e) => onUpdate({ repo: e.target.value })}
            placeholder="my-repo"
          />
        </div>
      </div>

      {(action === 'comment_issue') && (
        <div className="space-y-1.5">
          <Label>Issue number</Label>
          <Input
            type="number"
            value={(data.issueNumber as string) ?? ''}
            onChange={(e) => onUpdate({ issueNumber: e.target.value })}
            placeholder="42"
          />
        </div>
      )}

      {(action === 'create_issue' || action === 'create_pr') && (
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            value={(data.title as string) ?? ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Issue title"
          />
        </div>
      )}

      {(action === 'create_pr') && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Head branch</Label>
            <Input
              value={(data.head as string) ?? ''}
              onChange={(e) => onUpdate({ head: e.target.value })}
              placeholder="feature/my-branch"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Base branch</Label>
            <Input
              value={(data.base as string) ?? ''}
              onChange={(e) => onUpdate({ base: e.target.value })}
              placeholder="main"
            />
          </div>
        </div>
      )}

      {(action === 'create_issue' || action === 'comment_issue' || action === 'create_pr') && (
        <div className="space-y-1.5">
          <Label>{action === 'comment_issue' ? 'Comment' : 'Body'} <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            value={(data.body as string) ?? ''}
            onChange={(e) => onUpdate({ body: e.target.value })}
            rows={4}
          />
        </div>
      )}

      {action === 'create_issue' && (
        <div className="space-y-1.5">
          <Label>Labels <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            value={(data.labels as string) ?? ''}
            onChange={(e) => onUpdate({ labels: e.target.value })}
            placeholder="bug, enhancement"
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Token resolved from workspace secret <code>GITHUB_TOKEN</code>.
      </p>
    </div>
  );
}
