'use client';

import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@linea/ui/components/select';
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
  const kbId = (data.knowledgeBaseId as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="retriever-kb">Knowledge base ID</Label>
        <Input
          id="retriever-kb"
          value={kbId}
          onChange={(e) => onUpdate({ knowledgeBaseId: e.target.value })}
          placeholder="UUID of the knowledge base"
          className="font-mono text-xs"
        />
        {!kbId && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Required — find the ID in the Knowledge section of your pod.
          </p>
        )}
        {kbId && (
          <p className="text-[11px] text-muted-foreground">
            Search uses keyword matching against stored documents.
          </p>
        )}
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
        <Label>Top-K results</Label>
        <Select
          value={String((data.topK as number) ?? 5)}
          onValueChange={(v) => onUpdate({ topK: Number(v) })}
        >
          <SelectTrigger className="h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[3, 5, 10, 20].map((k) => (
              <SelectItem key={k} value={String(k)}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Output format</Label>
        <Select
          value={(data.outputField as string) ?? 'documents'}
          onValueChange={(v) => onUpdate({ outputField: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="documents">Documents array (with metadata)</SelectItem>
            <SelectItem value="text">Combined text (joined passages)</SelectItem>
            <SelectItem value="full">Full result (documents + count + query)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
