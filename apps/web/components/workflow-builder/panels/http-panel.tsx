'use client';

import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import { Label } from '@linea/ui/components/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@linea/ui/components/select';
import { VariableChips } from '../variable-picker';

interface HttpPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function HttpPanel({ data, onUpdate, nodes = [], nodeId }: HttpPanelProps) {
  const method = (data.method as string) ?? 'GET';
  const url = (data.url as string) ?? '';
  const body = (data.body as string) ?? '';
  const authType = (data.authType as string) ?? 'none';
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[100px_1fr] gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => onUpdate({ method: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>
      </div>

      <VariableChips
        nodes={nodes}
        currentNodeId={nodeId}
        value={url}
        onChange={(v) => onUpdate({ url: v })}
        fieldRef={urlRef}
      />

      {/* Auth */}
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label>Authentication</Label>
          <Select value={authType} onValueChange={(v) => onUpdate({ authType: v, authToken: '' })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer token</SelectItem>
              <SelectItem value="api-key">API key (X-API-Key)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {authType !== 'none' && (
          <div className="space-y-1.5">
            <Label htmlFor="http-auth-token">
              {authType === 'bearer' ? 'Token' : 'API Key'}
            </Label>
            <Input
              id="http-auth-token"
              type="password"
              value={(data.authToken as string) ?? ''}
              onChange={(e) => onUpdate({ authToken: e.target.value })}
              placeholder={authType === 'bearer' ? '{{variables.bearerToken}}' : '{{variables.apiKey}}'}
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="http-headers">Headers (JSON)</Label>
        <Textarea
          id="http-headers"
          rows={4}
          value={(data.headers as string) ?? ''}
          onChange={(e) => onUpdate({ headers: e.target.value })}
          placeholder={'{\n  "Content-Type": "application/json"\n}'}
          className="resize-y font-mono text-[11px]"
        />
      </div>

      {method !== 'GET' && method !== 'DELETE' && (
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
