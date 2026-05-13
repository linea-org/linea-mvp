'use client';

import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';
import { VariableChips } from '../variable-picker';

interface RetrieverPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

export function RetrieverPanel({ data, onUpdate, nodes = [], nodeId }: RetrieverPanelProps) {
  const queryRef = useRef<HTMLInputElement>(null);
  const query = (data.query as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="retriever-kb">Knowledge base ID</Label>
        <Input
          id="retriever-kb"
          value={(data.knowledgeBaseId as string) ?? ''}
          onChange={(e) => onUpdate({ knowledgeBaseId: e.target.value })}
          placeholder="UUID of the knowledge base"
        />
        <p className="text-[11px] text-muted-foreground">
          Find knowledge base IDs in the Knowledge section.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="retriever-query">Query</Label>
        <Input
          ref={queryRef}
          id="retriever-query"
          value={query}
          onChange={(e) => onUpdate({ query: e.target.value })}
          placeholder="{{input.question}} or a static query"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId}
          value={query}
          onChange={(v) => onUpdate({ query: v })}
          fieldRef={queryRef}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="retriever-topk">Top-K results</Label>
        <NativeSelect
          id="retriever-topk"
          value={String((data.topK as number) ?? 5)}
          onChange={(e) => onUpdate({ topK: Number(e.target.value) })}
          className="w-full"
        >
          {[3, 5, 10, 20].map((k) => (
            <NativeSelectOption key={k} value={String(k)}>{k}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="retriever-output">Output key</Label>
        <Input
          id="retriever-output"
          value={(data.outputKey as string) ?? 'results'}
          onChange={(e) => onUpdate({ outputKey: e.target.value })}
          placeholder="results"
        />
        <p className="text-[11px] text-muted-foreground">
          Retrieved documents are stored under this key in the workflow state.
        </p>
      </div>
    </div>
  );
}
