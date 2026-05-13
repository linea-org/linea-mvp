'use client';

import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Switch } from '@linea/ui/components/switch';
import { Textarea } from '@linea/ui/components/textarea';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { VariableChips } from '../variable-picker';

interface AgentPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

const modelOptions = [
  { value: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7',    label: 'Claude Opus 4.7' },
  { value: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5' },
  { value: 'gpt-4o',             label: 'GPT-4o' },
  { value: 'gpt-4o-mini',        label: 'GPT-4o Mini' },
  { value: 'groq/llama-3.3-70b', label: 'Llama 3.3 70B (Groq)' },
];

export function AgentPanel({ data, onUpdate, nodes = [], nodeId }: AgentPanelProps) {
  const instrRef = useRef<HTMLTextAreaElement>(null);
  const instructions = (data.instructions as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="agent-model">Model</Label>
        <NativeSelect
          id="agent-model"
          value={(data.model as string) ?? 'claude-sonnet-4-6'}
          onChange={(e) => onUpdate({ model: e.target.value })}
          className="w-full"
        >
          {modelOptions.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-instructions">Instructions</Label>
        <Textarea
          ref={instrRef}
          id="agent-instructions"
          rows={6}
          value={instructions}
          onChange={(e) => onUpdate({ instructions: e.target.value })}
          placeholder="System prompt / instructions…"
          className="resize-y font-sans text-xs"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId}
          value={instructions}
          onChange={(v) => onUpdate({ instructions: v })}
          fieldRef={instrRef}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="agent-history" className="cursor-pointer">Include chat history</Label>
        <Switch
          id="agent-history"
          checked={!!(data.includeChatHistory)}
          onCheckedChange={(v) => onUpdate({ includeChatHistory: v })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer" htmlFor="agent-ltm">Long-term memory</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Inject memories from past executions into context</p>
          </div>
          <Switch
            id="agent-ltm"
            checked={!!(data.enableLongTermMemory)}
            onCheckedChange={(v) => onUpdate({ enableLongTermMemory: v })}
          />
        </div>
        {!!data.enableLongTermMemory && (
          <p className="text-[10px] text-muted-foreground">
            When enabled, the agent will automatically recall relevant facts stored by previous runs of this workflow via <code>memory_store</code>. Make sure <code>memory_store</code> and <code>memory_search</code> are included in the tools list.
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer" htmlFor="agent-structured">Structured output</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Force the model to return typed JSON</p>
          </div>
          <Switch
            id="agent-structured"
            checked={!!(data.outputSchema)}
            onCheckedChange={(v) => onUpdate({ outputSchema: v ? '{\n  "type": "object",\n  "properties": {}\n}' : '' })}
          />
        </div>
        {!!data.outputSchema && (
          <div className="space-y-1.5">
            <Label>JSON Schema</Label>
            <Textarea
              rows={8}
              value={(data.outputSchema as string) ?? ''}
              onChange={(e) => onUpdate({ outputSchema: e.target.value })}
              className="resize-y font-mono text-xs"
              placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}'
            />
            <p className="text-[10px] text-muted-foreground">
              The model&apos;s output will be parsed as JSON matching this schema. The node output will be an object, not a string.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
