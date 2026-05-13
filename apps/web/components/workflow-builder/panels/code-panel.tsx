'use client';

import { Textarea } from '@linea/ui/components/textarea';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';

interface CodePanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

const DEFAULT_CODE = `// Available: state (workflow state object)
// Return: any value — stored as this node's output

const input = state.input ?? {};
return { processed: true, value: input };`;

export function CodePanel({ data, onUpdate }: CodePanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code-editor">JavaScript code</Label>
        <Textarea
          id="code-editor"
          rows={10}
          value={(data.code as string) ?? DEFAULT_CODE}
          onChange={(e) => onUpdate({ code: e.target.value })}
          className="resize-y font-mono text-[11px]"
        />
        <p className="text-[11px] text-muted-foreground">
          Runs in a sandboxed Node.js vm. Return a value to set this node&apos;s output.
          Async functions are not supported.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code-timeout">Timeout</Label>
        <NativeSelect
          id="code-timeout"
          value={String((data.timeout as number) ?? 5000)}
          onChange={(e) => onUpdate({ timeout: Number(e.target.value) })}
          className="w-full"
        >
          <NativeSelectOption value="1000">1 second</NativeSelectOption>
          <NativeSelectOption value="5000">5 seconds</NativeSelectOption>
          <NativeSelectOption value="10000">10 seconds</NativeSelectOption>
          <NativeSelectOption value="30000">30 seconds</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code-output-key">Output key</Label>
        <NativeSelect
          id="code-output-key"
          value={(data.outputKey as string) ?? 'result'}
          onChange={(e) => onUpdate({ outputKey: e.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="result">result</NativeSelectOption>
          <NativeSelectOption value="output">output</NativeSelectOption>
          <NativeSelectOption value="data">data</NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  );
}
