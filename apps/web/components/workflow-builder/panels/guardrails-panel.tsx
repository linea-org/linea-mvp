'use client';

import { Switch } from '@linea/ui/components/switch';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';

interface GuardrailsPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function GuardrailsPanel({ data, onUpdate }: GuardrailsPanelProps) {
  const checks = (data.checks as string[]) ?? [];

  function toggleCheck(check: string) {
    const next = checks.includes(check)
      ? checks.filter((c) => c !== check)
      : [...checks, check];
    onUpdate({ checks: next });
  }

  const checkOptions = [
    { key: 'pii',        label: 'PII detection',    description: 'Blocks names, emails, SSNs, phone numbers' },
    { key: 'jailbreak',  label: 'Jailbreak',         description: 'Detects prompt injection attempts' },
    { key: 'moderation', label: 'Content moderation', description: 'Flags harmful or offensive content' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Active checks</Label>
        {checkOptions.map((opt) => (
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
        <Label htmlFor="guardrails-action">On violation</Label>
        <NativeSelect
          id="guardrails-action"
          value={(data.action as string) ?? 'block'}
          onChange={(e) => onUpdate({ action: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="block">Block — stop execution</NativeSelectOption>
          <NativeSelectOption value="warn">Warn — log and continue</NativeSelectOption>
          <NativeSelectOption value="redact">Redact — remove sensitive data</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="guardrails-input-key">Input key to check</Label>
        <NativeSelect
          id="guardrails-input-key"
          value={(data.inputKey as string) ?? 'last_message'}
          onChange={(e) => onUpdate({ inputKey: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="last_message">Last message</NativeSelectOption>
          <NativeSelectOption value="input">Workflow input</NativeSelectOption>
          <NativeSelectOption value="output">Previous node output</NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  );
}
