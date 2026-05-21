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

const EXTRACTION_MODELS = [
  { value: '', label: 'Auto (server picks cheapest available)' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast, cheap' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini — fast, cheap' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — fast, cheap' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Groq) — cheapest' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
];

const CRON_PRESETS = [
  { label: 'Every 5 min',    value: '*/5 * * * *'  },
  { label: 'Every 15 min',   value: '*/15 * * * *' },
  { label: 'Every hour',     value: '0 * * * *'    },
  { label: 'Every day 9 AM', value: '0 9 * * *'    },
  { label: 'Weekdays 9 AM',  value: '0 9 * * 1-5'  },
  { label: 'Every Monday',   value: '0 9 * * 1'    },
  { label: 'Every month',    value: '0 9 1 * *'    },
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return 'Invalid expression';
  const [min, hour, day, month, weekday] = parts as [string, string, string, string, string];

  function fmtTime(h: string, m: string) {
    const hNum = parseInt(h);
    if (isNaN(hNum)) return `${h}:${m}`;
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const h12 = hNum % 12 || 12;
    return `${h12}:${m.padStart(2, '0')} ${ampm}`;
  }

  if (min === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') return 'Every minute';
  if (min.startsWith('*/') && hour === '*' && day === '*' && month === '*' && weekday === '*')
    return `Every ${min.slice(2)} minutes`;
  if (min === '0' && hour.startsWith('*/') && day === '*' && month === '*' && weekday === '*')
    return `Every ${hour.slice(2)} hours`;

  const parts_desc: string[] = [];

  if (weekday !== '*') {
    const days = weekday.split(',').map((d) => {
      if (d.includes('-')) {
        const [from, to] = d.split('-');
        return `${WEEKDAY_NAMES[parseInt(from!)] ?? from} to ${WEEKDAY_NAMES[parseInt(to!)] ?? to}`;
      }
      return WEEKDAY_NAMES[parseInt(d)] ?? d;
    }).join(', ');
    parts_desc.push(days);
  } else if (day !== '*') {
    parts_desc.push(`day ${day}`);
  } else {
    parts_desc.push('every day');
  }

  if (month !== '*') {
    const months = month.split(',').map((m) => MONTH_NAMES[parseInt(m) - 1] ?? m).join(', ');
    parts_desc.push(`in ${months}`);
  }

  if (hour !== '*' && min !== '*') {
    parts_desc.push(`at ${fmtTime(hour, min)}`);
  } else if (hour !== '*') {
    parts_desc.push(`at ${hour}:xx`);
  } else if (min !== '*') {
    parts_desc.push(`at minute ${min}`);
  }

  return parts_desc.join(', ');
}

export function StartPanel({ data, onUpdate }: StartPanelProps) {
  const triggerType: TriggerType = (data.triggerType as TriggerType) ?? 'manual';
  const vars: InputVar[] = (data.inputVariables as InputVar[]) ?? [];
  const testInput = (data.testInput as Record<string, string>) ?? {};
  const cronExpression: string = (data.cronExpression as string) ?? '0 9 * * *';
  const cronTimezone: string = (data.cronTimezone as string) ?? 'UTC';
  const extractionModel: string = (data.extractionModel as string) ?? '';

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
          {/* Human-readable preview */}
          <div className="rounded-md bg-primary/5 border border-primary/20 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-0.5">Preview</p>
            <p className="text-xs font-medium text-primary">{describeCron(cronExpression)}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{cronExpression}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Presets</Label>
            <div className="grid grid-cols-2 gap-1">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onUpdate({ cronExpression: p.value })}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors text-left',
                    cronExpression === p.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Custom expression</Label>
            <Input
              value={cronExpression}
              onChange={(e) => onUpdate({ cronExpression: e.target.value })}
              placeholder="*/5 * * * *"
              className="font-mono text-xs"
            />
            <div className="grid grid-cols-5 gap-1 text-center">
              {['min', 'hour', 'day', 'mon', 'wday'].map((f) => (
                <span key={f} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">{f}</span>
              ))}
            </div>
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

      {/* Extraction model — shown when there are input variables (public API enrichment) */}
      {(triggerType === 'manual' || triggerType === 'webhook') && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <Label>Input Extraction Model</Label>
          <NativeSelect
            value={extractionModel}
            onChange={(e) => onUpdate({ extractionModel: e.target.value })}
            className="w-full"
          >
            {EXTRACTION_MODELS.map((m) => (
              <NativeSelectOption key={m.value} value={m.value}>{m.label}</NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-[10px] text-muted-foreground">
            Used when the public API receives a natural-language message and needs to extract typed input variables from it.
          </p>
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
