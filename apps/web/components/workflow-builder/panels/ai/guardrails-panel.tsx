'use client';

import { Switch } from '@linea/ui/components/switch';
import { Label } from '@linea/ui/components/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@linea/ui/components/select';

interface GuardrailsPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

const CHECK_OPTIONS = [
  { key: 'pii',        label: 'PII detection',       description: 'Emails, phone numbers, SSNs, credit cards, IPs' },
  { key: 'jailbreak',  label: 'Jailbreak detection',  description: 'Detects prompt injection and override attempts' },
  { key: 'moderation', label: 'Content moderation',   description: 'Flags harmful or offensive language' },
];

export function GuardrailsPanel({ data, onUpdate }: GuardrailsPanelProps) {
  const checks = (data.checks as string[]) ?? [];

  function toggleCheck(check: string) {
    const next = checks.includes(check)
      ? checks.filter((c) => c !== check)
      : [...checks, check];
    onUpdate({ checks: next });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Active checks</Label>
        {CHECK_OPTIONS.map((opt) => (
          <div key={opt.key} className="flex items-start gap-3">
            <Switch
              id={`check-${opt.key}`}
              checked={checks.includes(opt.key)}
              onCheckedChange={() => toggleCheck(opt.key)}
            />
            <div>
              <label htmlFor={`check-${opt.key}`} className="block text-xs font-medium cursor-pointer">
                {opt.label}
              </label>
              <p className="text-[11px] text-muted-foreground">{opt.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>On violation</Label>
        <Select
          value={(data.action as string) ?? 'block'}
          onValueChange={(v) => onUpdate({ action: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="block">Block — stop execution</SelectItem>
            <SelectItem value="warn">Warn — log and continue</SelectItem>
            <SelectItem value="redact">Redact — remove sensitive data and continue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Text to check</Label>
        <Select
          value={(data.inputKey as string) ?? 'output'}
          onValueChange={(v) => onUpdate({ inputKey: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="output">Previous node output (lastOutput)</SelectItem>
            <SelectItem value="input">Workflow input</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
