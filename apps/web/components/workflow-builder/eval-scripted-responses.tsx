'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, Alert02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import type { ScriptedResponse } from './evals-panel.types';

interface EvalScriptedResponsesProps {
  responses: ScriptedResponse[];
  onChange: (responses: ScriptedResponse[]) => void;
}

export function EvalScriptedResponses({ responses, onChange }: EvalScriptedResponsesProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-[10px]">Interrupt Responses</Label>
          <span title="Pre-configured answers for approval/ask_human nodes. Consumed in order when the workflow suspends.">
            <HugeiconsIcon icon={Alert02Icon} className="size-3 text-muted-foreground/50 cursor-help" />
          </span>
        </div>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onChange([...responses, { type: 'answer', value: '' }])}
        >
          <HugeiconsIcon icon={Add01Icon} />
          Add
        </Button>
      </div>

      {responses.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/60 text-center py-1">
          No responses — workflow will fail if it suspends.
        </p>
      ) : (
        <div className="space-y-1.5">
          {responses.map((sr, si) => (
            <div key={si} className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground w-4 shrink-0 text-right">{si + 1}.</span>
              <Select
                value={sr.type}
                onValueChange={(v) => {
                  const updated = [...responses];
                  updated[si] = { ...sr, type: v as ScriptedResponse['type'] };
                  onChange(updated);
                }}
              >
                <SelectTrigger className="h-6 w-20 shrink-0 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answer">Answer</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="deny">Deny</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={sr.value}
                onChange={(e) => {
                  const updated = [...responses];
                  updated[si] = { ...sr, value: e.target.value };
                  onChange(updated);
                }}
                placeholder={sr.type === 'answer' ? 'Response text…' : 'Comment (optional)'}
                className="h-6 text-[11px] flex-1"
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onChange(responses.filter((_, i) => i !== si))}
                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <HugeiconsIcon icon={Delete01Icon} className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
