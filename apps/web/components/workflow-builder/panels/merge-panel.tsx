'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Button } from '@linea/ui/components/button';

interface MergePanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

const MODES = [
  { id: 'concat', label: 'Concat',  desc: 'Concatenate arrays into one flat array.' },
  { id: 'merge',  label: 'Merge',   desc: 'Deep-merge objects into a single object.' },
  { id: 'zip',    label: 'Zip',     desc: 'Pair elements by index into tuples.' },
] as const;

export function MergePanel({ data, onUpdate }: MergePanelProps) {
  const sources: string[] = Array.isArray(data.sources) ? (data.sources as string[]) : [''];
  const mode: string = (data.mode as string) ?? 'concat';

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]!;

  function updateSources(updated: string[]) {
    onUpdate({ sources: updated });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Mode</Label>
        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onUpdate({ mode: m.id })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                mode === m.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{activeMode.desc}</p>
      </div>

      <div className="space-y-1.5">
        <Label>Sources</Label>
        <div className="space-y-1.5">
          {sources.map((src, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={src}
                onChange={(e) => {
                  const next = [...sources];
                  next[i] = e.target.value;
                  updateSources(next);
                }}
                placeholder={`variable name ${i + 1}`}
                className="flex-1 font-mono text-[11px]"
              />
              {sources.length > 1 && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => updateSources(sources.filter((_, idx) => idx !== i))}
                >
                  <HugeiconsIcon icon={Delete01Icon} className="size-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => updateSources([...sources, ''])}
          className="h-7 gap-1.5 text-xs text-muted-foreground"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          Add source
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Variable names to merge. Each should hold an{' '}
          {mode === 'merge' ? 'object' : 'array'}.
        </p>
      </div>
    </div>
  );
}
