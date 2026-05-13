'use client';

import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';
import { VariableChips } from '../variable-picker';

interface ExtractPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

const outputOptions = [
  { value: 'full',     label: 'Full response' },
  { value: 'text',     label: 'Text only' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json',     label: 'JSON parsed' },
];

export function ExtractPanel({ data, onUpdate, nodes = [], nodeId }: ExtractPanelProps) {
  const urlRef = useRef<HTMLInputElement>(null);
  const url = (data.url as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="extract-url">URL</Label>
        <Input
          ref={urlRef}
          id="extract-url"
          value={url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://example.com or {{input.url}}"
        />
        <p className="text-[11px] text-muted-foreground">
          Supports variable substitution. Uses Firecrawl if API key is set, otherwise native fetch.
        </p>
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId}
          value={url}
          onChange={(v) => onUpdate({ url: v })}
          fieldRef={urlRef}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="extract-selector">CSS selector (optional)</Label>
        <Input
          id="extract-selector"
          value={(data.selector as string) ?? ''}
          onChange={(e) => onUpdate({ selector: e.target.value })}
          placeholder="article, .content, #main"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="extract-output">Output format</Label>
        <NativeSelect
          id="extract-output"
          value={(data.outputFormat as string) ?? 'text'}
          onChange={(e) => onUpdate({ outputFormat: e.target.value })}
          className="w-full"
        >
          {outputOptions.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="extract-headers">Custom headers (JSON, optional)</Label>
        <Textarea
          id="extract-headers"
          rows={3}
          value={(data.headers as string) ?? ''}
          onChange={(e) => onUpdate({ headers: e.target.value })}
          placeholder={'{\n  "Authorization": "Bearer {{secret.token}}"\n}'}
          className="resize-y font-mono text-[11px]"
        />
      </div>
    </div>
  );
}
