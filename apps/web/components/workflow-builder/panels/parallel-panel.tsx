'use client';

import { useState } from 'react';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Textarea } from '@linea/ui/components/textarea';
import { Switch } from '@linea/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';

interface ParallelBranch {
  id: string;
  label: string;
  type: string;
  config: Record<string, unknown>;
}

interface ParallelPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

const BRANCH_TYPES = [
  { value: 'http',      label: 'HTTP Request' },
  { value: 'agent',     label: 'Agent' },
  { value: 'transform', label: 'Transform' },
  { value: 'code',      label: 'Code' },
];

function BranchEditor({
  branch,
  onUpdate,
  onRemove,
}: {
  branch: ParallelBranch;
  onUpdate: (b: ParallelBranch) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-md border border-border bg-muted/20">
      <div className="flex items-center gap-2 p-2">
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <Input
          value={branch.label}
          onChange={(e) => onUpdate({ ...branch, label: e.target.value })}
          placeholder="Branch name"
          className="h-6 flex-1 text-xs"
        />
        <Select
          value={branch.type}
          onValueChange={(v) => onUpdate({ ...branch, type: v })}
        >
          <SelectTrigger className="h-6 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRANCH_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          ×
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border p-2">
          {branch.type === 'http' && (
            <div className="space-y-1.5">
              <Input
                placeholder="URL"
                value={(branch.config.url as string) ?? ''}
                onChange={(e) => onUpdate({ ...branch, config: { ...branch.config, url: e.target.value } })}
                className="font-mono text-xs"
              />
              <Select
                value={(branch.config.method as string) ?? 'GET'}
                onValueChange={(v) => onUpdate({ ...branch, config: { ...branch.config, method: v } })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {branch.type === 'agent' && (
            <Textarea
              placeholder="System prompt"
              value={(branch.config.systemPrompt as string) ?? ''}
              onChange={(e) => onUpdate({ ...branch, config: { ...branch.config, systemPrompt: e.target.value } })}
              rows={3}
              className="text-xs resize-none"
            />
          )}
          {branch.type === 'transform' && (
            <Textarea
              placeholder="input.score * 100"
              value={(branch.config.transformScript as string) ?? ''}
              onChange={(e) => onUpdate({ ...branch, config: { ...branch.config, transformScript: e.target.value } })}
              rows={3}
              className="font-mono text-xs resize-none"
            />
          )}
          {branch.type === 'code' && (
            <Textarea
              placeholder="JavaScript code (return a value)"
              value={(branch.config.code as string) ?? ''}
              onChange={(e) => onUpdate({ ...branch, config: { ...branch.config, code: e.target.value } })}
              rows={4}
              className="font-mono text-xs resize-none"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ParallelPanel({ data, onUpdate }: ParallelPanelProps) {
  const branches = (data.branches as ParallelBranch[]) ?? [];
  const failFast = (data.failFast as boolean) ?? false;

  function addBranch() {
    const newBranch: ParallelBranch = {
      id: Math.random().toString(36).slice(2, 10),
      label: `Branch ${branches.length + 1}`,
      type: 'http',
      config: {},
    };
    onUpdate({ branches: [...branches, newBranch] });
  }

  function updateBranch(index: number, branch: ParallelBranch) {
    onUpdate({ branches: branches.map((b, i) => (i === index ? branch : b)) });
  }

  function removeBranch(index: number) {
    onUpdate({ branches: branches.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Each branch runs concurrently. Results are collected once all branches settle.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Branches ({branches.length})</Label>

        {branches.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No branches yet. Add one to get started.</p>
        )}

        {branches.map((branch, i) => (
          <BranchEditor
            key={branch.id}
            branch={branch}
            onUpdate={(b) => updateBranch(i, b)}
            onRemove={() => removeBranch(i)}
          />
        ))}

        <Button variant="outline" size="sm" onClick={addBranch} className="w-full">
          + Add branch
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-2">
        <div>
          <p className="text-xs font-medium">Fail on any error</p>
          <p className="text-[10px] text-muted-foreground">Throw if any branch fails (all branches still run to completion)</p>
        </div>
        <Switch
          checked={failFast}
          onCheckedChange={(v) => onUpdate({ failFast: v })}
        />
      </div>
    </div>
  );
}
