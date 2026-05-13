'use client';

import { Input } from '@linea/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';

interface MemoryPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function MemoryPanel({ data, onUpdate }: MemoryPanelProps) {
  const mode = (data.memoryMode as string) ?? 'smart';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="memory-mode">Memory Mode</Label>
        <NativeSelect
          id="memory-mode"
          value={mode}
          onChange={(e) => onUpdate({ memoryMode: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="smart">Smart (auto)</NativeSelectOption>
          <NativeSelectOption value="retrieve">Retrieve</NativeSelectOption>
          <NativeSelectOption value="clear">Clear</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="memory-scope">Memory Scope</Label>
        <NativeSelect
          id="memory-scope"
          value={(data.memoryScope as string) ?? 'thread'}
          onChange={(e) => onUpdate({ memoryScope: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="thread">Thread</NativeSelectOption>
          <NativeSelectOption value="workflow">Workflow</NativeSelectOption>
          <NativeSelectOption value="user">User</NativeSelectOption>
        </NativeSelect>
      </div>

      {mode === 'retrieve' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="memory-query">Query</Label>
            <Input
              id="memory-query"
              value={(data.memoryQuery as string) ?? ''}
              onChange={(e) => onUpdate({ memoryQuery: e.target.value })}
              placeholder="e.g. {{userIntent}}"
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
