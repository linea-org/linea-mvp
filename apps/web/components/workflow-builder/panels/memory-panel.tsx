'use client';

import { Input } from '@linea/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';
import { Textarea } from '@linea/ui/components/textarea';

interface MemoryPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  smart:    'LLM-managed memory — the agent decides what to store.',
  retrieve: 'Query stored entries by keyword or key name.',
  write:    'Explicitly save a key-value pair to memory.',
  delete:   'Remove a specific key from memory.',
  clear:    'Wipe all entries in the selected scope.',
};

export function MemoryPanel({ data, onUpdate }: MemoryPanelProps) {
  const mode  = (data.memoryMode  as string) ?? 'retrieve';
  const scope = (data.memoryScope as string) ?? 'thread';

  const showSessionKey = scope === 'session';
  const showKey        = mode === 'write' || mode === 'delete';
  const showValue      = mode === 'write';
  const showQuery      = mode === 'retrieve';

  return (
    <div className="space-y-4">
      {/* Mode */}
      <div className="space-y-1.5">
        <Label htmlFor="memory-mode">Mode</Label>
        <NativeSelect
          id="memory-mode"
          value={mode}
          onChange={(e) => onUpdate({ memoryMode: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="retrieve">Retrieve</NativeSelectOption>
          <NativeSelectOption value="write">Write</NativeSelectOption>
          <NativeSelectOption value="delete">Delete</NativeSelectOption>
          <NativeSelectOption value="clear">Clear</NativeSelectOption>
          <NativeSelectOption value="smart">Smart (auto)</NativeSelectOption>
        </NativeSelect>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {MODE_DESCRIPTIONS[mode]}
        </p>
      </div>

      {/* Scope */}
      <div className="space-y-1.5">
        <Label htmlFor="memory-scope">Scope</Label>
        <NativeSelect
          id="memory-scope"
          value={scope}
          onChange={(e) => onUpdate({ memoryScope: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="thread">Thread — this conversation</NativeSelectOption>
          <NativeSelectOption value="workflow">Workflow — shared across all callers</NativeSelectOption>
          <NativeSelectOption value="session">Session — isolated per caller (B2B)</NativeSelectOption>
        </NativeSelect>
      </div>

      {/* Session key — only shown for session scope */}
      {showSessionKey && (
        <div className="space-y-1.5">
          <Label htmlFor="memory-session-key">Session Key</Label>
          <Input
            id="memory-session-key"
            value={(data.memorySessionKey as string) ?? ''}
            onChange={(e) => onUpdate({ memorySessionKey: e.target.value })}
            placeholder="e.g. {{input.userId}}"
          />
          <p className="text-[11px] text-muted-foreground leading-snug">
            Expression that uniquely identifies the caller. Each distinct value gets its own isolated memory namespace.
          </p>
        </div>
      )}

      {/* Key field — write / delete */}
      {showKey && (
        <div className="space-y-1.5">
          <Label htmlFor="memory-key">Key</Label>
          <Input
            id="memory-key"
            value={(data.memoryKey as string) ?? ''}
            onChange={(e) => onUpdate({ memoryKey: e.target.value })}
            placeholder="e.g. userPreferences"
          />
        </div>
      )}

      {/* Value field — write only */}
      {showValue && (
        <div className="space-y-1.5">
          <Label htmlFor="memory-value">Value</Label>
          <Textarea
            id="memory-value"
            value={(data.memoryValue as string) ?? ''}
            onChange={(e) => onUpdate({ memoryValue: e.target.value })}
            placeholder={'e.g. {{agentOutput}} or {"theme":"dark"}'}
            className="font-mono text-xs min-h-[80px]"
          />
          <p className="text-[11px] text-muted-foreground leading-snug">
            Supports {'{{variable}}'} interpolation. JSON values are stored as-is.
          </p>
        </div>
      )}

      {/* Query — retrieve only */}
      {showQuery && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="memory-query">Query</Label>
            <Input
              id="memory-query"
              value={(data.memoryQuery as string) ?? ''}
              onChange={(e) => onUpdate({ memoryQuery: e.target.value })}
              placeholder="e.g. {{userIntent}} or leave blank for all"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memory-topk">Top-K Results</Label>
            <Input
              id="memory-topk"
              type="number"
              min={1}
              max={100}
              value={(data.memoryTopK as number) ?? 5}
              onChange={(e) => onUpdate({ memoryTopK: parseInt(e.target.value, 10) })}
            />
          </div>
        </>
      )}
    </div>
  );
}
