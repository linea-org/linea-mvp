"use client"

import { useRef } from "react"
import type { Node } from "@xyflow/react"
import { Input } from "@linea/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"
import { Label } from "@linea/ui/components/label"
import { VariableChips } from "../variable-picker"
import { ModelPicker } from "../model-picker"

interface RetrieverPanelProps {
  data: Record<string, unknown>
  onUpdate: (data: Record<string, unknown>) => void
  nodes?: Node[]
  nodeId?: string
}

export function RetrieverPanel({
  data,
  onUpdate,
  nodes = [],
  nodeId,
}: RetrieverPanelProps) {
  const queryRef = useRef<HTMLInputElement>(null)
  const query = (data.query as string) ?? ""

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="retriever-kb">Knowledge base ID</Label>
        <Input
          id="retriever-kb"
          value={(data.knowledgeBaseId as string) ?? ""}
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
        <Select
          value={String((data.topK as number) ?? 5)}
          onValueChange={(v) => onUpdate({ topK: Number(v) })}
        >
          <SelectTrigger id="retriever-topk" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[3, 5, 10, 20].map((k) => (
              <SelectItem key={k} value={String(k)}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Embedding model</Label>
        <ModelPicker
          value={(data.embeddingModel as string) ?? "text-embedding-3-small"}
          onValueChange={(v) => onUpdate({ embeddingModel: v })}
          embeddingOnly
        />
        <p className="text-[11px] text-muted-foreground">
          Used to convert the query into a vector for similarity search. Must
          match the model used when the knowledge base was indexed.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="retriever-output">Output format</Label>
        <Select
          value={(data.outputField as string) ?? "documents"}
          onValueChange={(v) => onUpdate({ outputField: v })}
        >
          <SelectTrigger id="retriever-output" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="documents">
              Documents (array with metadata)
            </SelectItem>
            <SelectItem value="text">Text (concatenated string)</SelectItem>
            <SelectItem value="full">
              Full (documents + count + query)
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Controls what shape this node outputs to downstream nodes.
        </p>
      </div>
    </div>
  )
}
