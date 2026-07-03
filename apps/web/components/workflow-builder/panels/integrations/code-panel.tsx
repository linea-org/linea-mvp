'use client';

import { Textarea } from '@linea/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
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
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Node currently disabled</p>
        <p className="text-[11px] text-amber-600 dark:text-amber-500 leading-snug mt-0.5">
          Arbitrary code execution requires a dedicated Pod VM (Kata Containers / Firecracker) for safe sandboxing.
          This node will throw at runtime until Pod VM infrastructure is available.
          Use the <strong>Agent</strong> node for logic-heavy steps in the meantime.
        </p>
      </div>

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
        <Label>Timeout</Label>
        <Select
          value={String((data.timeoutMs as number) ?? 5000)}
          onValueChange={(v) => onUpdate({ timeoutMs: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1000">1 second</SelectItem>
            <SelectItem value="5000">5 seconds</SelectItem>
            <SelectItem value="10000">10 seconds</SelectItem>
            <SelectItem value="30000">30 seconds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Output key</Label>
        <Select
          value={(data.outputKey as string) ?? 'result'}
          onValueChange={(v) => onUpdate({ outputKey: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="result">result</SelectItem>
            <SelectItem value="output">output</SelectItem>
            <SelectItem value="data">data</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
