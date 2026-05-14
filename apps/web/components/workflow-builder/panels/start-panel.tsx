'use client';

import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, WebhookIcon, ClockIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { cn } from '@linea/ui/lib/utils';

interface StartPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

interface InputVar { name: string; type: 'string' | 'number' | 'boolean' | 'object'; required: boolean }

type TriggerType = 'manual' | 'webhook' | 'schedule';

const TRIGGERS: { value: TriggerType; label: string; icon: IconSvgElement; description: string }[] = [
  { value: 'manual',   label: 'Manual',   icon: PlayIcon,            description: 'Run from the builder or API' },
  { value: 'webhook',  label: 'Webhook',  icon: WebhookIcon,         description: 'Triggered by HTTP POST' },
  { value: 'schedule', label: 'Schedule', icon: ClockIcon,           description: 'Runs on a cron schedule' },
];

const CRON_PRESETS = [
  { label: 'Every 5 min',  value: '*/5 * * * *' },
  { label: 'Every hour',   value: '0 * * * *' },
  { label: 'Every day',    value: '0 9 * * *' },
  { label: 'Every week',   value: '0 9 * * 1' },
  { label: 'Custom',       value: '__custom__' },
];

export function StartPanel({ data, onUpdate }: StartPanelProps) {
  const triggerType: TriggerType = (data.triggerType as TriggerType) ?? 'manual';
  const vars: InputVar[] = (data.inputVariables as InputVar[]) ?? [];
  const testInput = (data.testInput as Record<string, string>) ?? {};
  const cronExpression: string = (data.cronExpression as string) ?? '0 9 * * *';
  const cronTimezone: string = (data.cronTimezone as string) ?? 'UTC';

  function update(index: number, field: keyof InputVar, value: unknown) {
    onUpdate({ inputVariables: vars.map((v, i) => (i === index ? { ...v, [field]: value } : v)) });
  }

  function setTestValue(name: string, value: string) {
    onUpdate({ testInput: { ...testInput, [name]: value } });
  }

  return (
    <div className="space-y-4">
      {/* Trigger type selector */}
      <div className="space-y-2">
        <Label>Trigger</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRIGGERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onUpdate({ triggerType: t.value })}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors',
                triggerType === t.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
              )}
            >
              <HugeiconsIcon icon={t.icon} className="size-4" strokeWidth={1.5} />
              <span className="text-[10px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {TRIGGERS.find((t) => t.value === triggerType)?.description}
        </p>
      </div>

      {/* Schedule config */}
      {triggerType === 'schedule' && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label>Cron Expression</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {CRON_PRESETS.slice(0, -1).map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onUpdate({ cronExpression: p.value })}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors text-left',
                    cronExpression === p.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  {p.label}
                  <span className="ml-1 font-mono opacity-60">{p.value}</span>
                </button>
              ))}
            </div>
            <Input
              value={cronExpression}
              onChange={(e) => onUpdate({ cronExpression: e.target.value })}
              placeholder="*/5 * * * *"
              className="font-mono text-xs mt-1.5"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: <span className="font-mono">minute hour day month weekday</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input
              value={cronTimezone}
              onChange={(e) => onUpdate({ cronTimezone: e.target.value })}
              placeholder="UTC"
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              IANA timezone (e.g. America/New_York, Europe/London)
            </p>
          </div>
        </div>
      )}

      {/* Webhook info */}
      {triggerType === 'webhook' && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-medium">Webhook Trigger</p>
          <p className="text-[10px] text-muted-foreground">
            Deploy this workflow and use the Webhook panel (
            <span className="font-mono">⌘ toolbar → Webhook</span>) to get your endpoint URL.
            Incoming POST body is available as input variables.
          </p>
        </div>
      )}

      {/* Input variable schema */}
      {(triggerType === 'manual' || triggerType === 'webhook') && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <Label>Input Variables</Label>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onUpdate({ inputVariables: [...vars, { name: '', type: 'string', required: false }] })}
            >
              <HugeiconsIcon icon={Add01Icon} />
              Add
            </Button>
          </div>

          {vars.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No input variables defined.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_32px_24px] gap-1 px-0.5">
                {['Name', 'Type', 'Req', ''].map((h) => (
                  <span key={h} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{h}</span>
                ))}
              </div>
              {vars.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_32px_24px] items-center gap-1">
                  <Input
                    value={v.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    placeholder="varName"
                    className="text-xs"
                  />
                  <NativeSelect
                    value={v.type}
                    onChange={(e) => update(i, 'type', e.target.value)}
                    className="w-full"
                  >
                    {['string', 'number', 'boolean', 'object'].map((t) => (
                      <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={v.required}
                      onChange={(e) => update(i, 'required', e.target.checked)}
                      className="size-3.5 accent-primary"
                    />
                  </div>
                  <Button
                    size="icon-xs"
                    variant="destructive"
                    onClick={() => onUpdate({ inputVariables: vars.filter((_, j) => j !== i) })}
                  >
                    <HugeiconsIcon icon={Delete01Icon} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test values — manual only */}
      {triggerType === 'manual' && vars.filter((v) => v.name).length > 0 && (
        <div className="space-y-2.5 border-t border-border pt-3">
          <div>
            <Label>Test Values</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Values used when you click Run.
            </p>
          </div>
          {vars.filter((v) => v.name).map((v) => (
            <div key={v.name} className="space-y-0.5">
              <span className="text-[10px] font-medium text-muted-foreground font-mono">{v.name}</span>
              <Input
                value={testInput[v.name] ?? ''}
                onChange={(e) => setTestValue(v.name, e.target.value)}
                placeholder={v.type === 'object' ? '{"key": "value"}' : `Enter ${v.name}…`}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
