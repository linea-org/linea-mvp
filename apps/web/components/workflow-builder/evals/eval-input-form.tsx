'use client';

import { useMemo } from 'react';
import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import { Switch } from '@linea/ui/components/switch';
import { Label } from '@linea/ui/components/label';

export interface InputVar {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
}

interface EvalInputFormProps {
  inputVariables?: InputVar[];
  value: string;
  onChange: (json: string) => void;
}

function inferVarsFromJson(json: string): InputVar[] {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    if (typeof obj !== 'object' || !obj || Array.isArray(obj)) return [];
    return Object.entries(obj).map(([name, v]) => ({
      name,
      type: (typeof v === 'boolean' ? 'boolean'
           : typeof v === 'number' ? 'number'
           : v !== null && typeof v === 'object' ? 'object'
           : 'string') as InputVar['type'],
      required: false,
    }));
  } catch {
    return [];
  }
}

export function EvalInputForm({ inputVariables, value, onChange }: EvalInputFormProps) {
  const parsed = useMemo(() => {
    try { return JSON.parse(value) as Record<string, unknown>; }
    catch { return {} as Record<string, unknown>; }
  }, [value]);

  const effectiveVars = useMemo(() => {
    if (inputVariables && inputVariables.length > 0) return inputVariables;
    const inferred = inferVarsFromJson(value);
    return inferred.length > 0 ? inferred : null;
  }, [inputVariables, value]);

  function set(name: string, val: unknown) {
    onChange(JSON.stringify({ ...parsed, [name]: val }));
  }

  if (!effectiveVars) {
    return (
      <div className="space-y-1">
        <Label className="text-[10px]">Input JSON</Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-[11px] min-h-[60px] resize-none"
          placeholder='{"key": "value"}'
        />
        <p className="text-[9px] text-muted-foreground">
          Define Input Variables on the Start node to get typed fields here.
        </p>
      </div>
    );
  }

  const vars = effectiveVars;

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px]">Inputs</Label>
      <div className="space-y-2 rounded-md border border-border bg-background p-2">
        {vars.map((v) => {
          const currentVal = parsed[v.name];
          return (
            <div key={v.name} className="space-y-0.5">
              <label className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {v.name}
                {v.required && <span className="text-destructive">*</span>}
                <span className="normal-case tracking-normal opacity-50">({v.type})</span>
              </label>

              {v.type === 'boolean' ? (
                <div className="flex items-center gap-2 py-0.5">
                  <Switch
                    checked={Boolean(currentVal)}
                    onCheckedChange={(checked) => set(v.name, checked)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {Boolean(currentVal) ? 'true' : 'false'}
                  </span>
                </div>
              ) : v.type === 'object' ? (
                <Textarea
                  value={
                    currentVal == null
                      ? ''
                      : typeof currentVal === 'string'
                      ? currentVal
                      : JSON.stringify(currentVal, null, 2)
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    try { set(v.name, JSON.parse(raw)); }
                    catch { set(v.name, raw); }
                  }}
                  className="font-mono text-[11px] min-h-[52px] resize-none"
                  placeholder="{}"
                />
              ) : (
                <Input
                  type={v.type === 'number' ? 'number' : 'text'}
                  value={currentVal == null ? '' : String(currentVal)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (v.type === 'number') {
                      set(v.name, raw === '' ? '' : parseFloat(raw));
                    } else {
                      set(v.name, raw);
                    }
                  }}
                  className="h-7 text-[11px]"
                  placeholder={v.type === 'number' ? '0' : 'value…'}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
