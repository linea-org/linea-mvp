'use client';

import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import { Label } from '@linea/ui/components/label';

interface ApprovalPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function ApprovalPanel({ data, onUpdate }: ApprovalPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="approval-message">Approval Message</Label>
        <Textarea
          id="approval-message"
          rows={5}
          value={(data.approvalMessage as string) ?? ''}
          onChange={(e) => onUpdate({ approvalMessage: e.target.value })}
          placeholder="Please review and approve this action…"
          className="resize-y"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="approval-instructions">Instructions for Approver</Label>
        <Input
          id="approval-instructions"
          value={(data.instructions as string) ?? ''}
          onChange={(e) => onUpdate({ instructions: e.target.value })}
          placeholder="Hint shown to the approver…"
        />
      </div>
    </div>
  );
}
