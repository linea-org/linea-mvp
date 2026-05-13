'use client';

import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';
import { VariableChips } from '../variable-picker';

interface HttpPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function HttpPanel({ data, onUpdate, nodes = [], nodeId }: HttpPanelProps) {
  const method = (data.method as string) ?? 'GET';
  const url = (data.url as string) ?? '';
  const body = (data.body as string) ?? '';
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="http-method">Method</Label>
        <NativeSelect
          id="http-method"
          value={method}
          onChange={(e) => onUpdate({ method: e.target.value })}
          className="w-full"
        >
          {methods.map((m) => (
            <NativeSelectOption key={m} value={m}>{m}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="http-url">URL</Label>
        <Input
          ref={urlRef}
          id="http-url"
          type="text"
          value={url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://api.example.com/{{endpoint}}"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId}
          value={url}
          onChange={(v) => onUpdate({ url: v })}
          fieldRef={urlRef}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="http-headers">Headers (JSON)</Label>
        <Textarea
          id="http-headers"
          rows={4}
          value={(data.headers as string) ?? ''}
          onChange={(e) => onUpdate({ headers: e.target.value })}
          placeholder={'{\n  "Authorization": "Bearer {{token}}"\n}'}
          className="resize-y font-mono text-[11px]"
        />
      </div>

      {method !== 'GET' && (
        <div className="space-y-1.5">
          <Label htmlFor="http-body">Body (JSON)</Label>
          <Textarea
            ref={bodyRef}
            id="http-body"
            rows={5}
            value={body}
            onChange={(e) => onUpdate({ body: e.target.value })}
            placeholder={'{\n  "key": "{{value}}"\n}'}
            className="resize-y font-mono text-[11px]"
          />
          <VariableChips
            nodes={nodes}
            currentNodeId={nodeId}
            value={body}
            onChange={(v) => onUpdate({ body: v })}
            fieldRef={bodyRef}
          />
        </div>
      )}
    </div>
  );
}
