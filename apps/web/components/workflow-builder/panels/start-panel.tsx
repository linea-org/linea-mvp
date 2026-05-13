'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';

interface StartPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

interface InputVar { name: string; type: 'string' | 'number' | 'boolean' | 'object'; required: boolean }

export function StartPanel({ data, onUpdate }: StartPanelProps) {
  const vars: InputVar[] = (data.inputVariables as InputVar[]) ?? [];
  const testInput = (data.testInput as Record<string, string>) ?? {};

  function update(index: number, field: keyof InputVar, value: unknown) {
    onUpdate({ inputVariables: vars.map((v, i) => (i === index ? { ...v, [field]: value } : v)) });
  }

  function setTestValue(name: string, value: string) {
    onUpdate({ testInput: { ...testInput, [name]: value } });
  }

  return (
    <div className="space-y-4">
      {/* Input variable schema */}
      <div className="space-y-3">
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

      {/* Test values */}
      {vars.filter((v) => v.name).length > 0 && (
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
