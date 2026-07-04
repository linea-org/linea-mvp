"use client"

<<<<<<< HEAD:apps/web/components/workflow-builder/panels/loop-panel.tsx
import { useRef } from "react"
import type { Node } from "@xyflow/react"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { VariableChips } from "../variable-picker"
=======
import { useRef } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { VariableChips } from '../../variable-picker';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/panels/control-flow/loop-panel.tsx

interface LoopPanelProps {
  data: Record<string, unknown>
  onUpdate: (fields: Record<string, unknown>) => void
  nodes?: Node[]
  nodeId?: string
}

export function LoopPanel({
  data,
  onUpdate,
  nodes = [],
  nodeId,
}: LoopPanelProps) {
  const arrayRef = useRef<HTMLInputElement>(null)
  const transformRef = useRef<HTMLInputElement>(null)

  const arrayPath = (data.arrayPath as string) ?? ""
  const itemTransform = (data.itemTransform as string) ?? ""
  const maxIterations = (data.maxIterations as number) ?? 100

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Array variable</Label>
        <Input
          ref={arrayRef}
          value={arrayPath}
          onChange={(e) => onUpdate({ arrayPath: e.target.value })}
          placeholder="items or {{start.items}}"
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId ?? ""}
          value={arrayPath}
          onChange={(v) => onUpdate({ arrayPath: v })}
          fieldRef={arrayRef}
        />
        <p className="text-xs text-muted-foreground">
          Dot-path into workflow variables (e.g. <code>start.items</code>) or a{" "}
          <code>{"{{variable}}"}</code> chip.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>
          Item transform{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          ref={transformRef}
          value={itemTransform}
          onChange={(e) => onUpdate({ itemTransform: e.target.value })}
          placeholder="item.name"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          JS expression evaluated per element. Use <code>item</code> for the
          current element. Leave blank to collect the array as-is.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Max iterations</Label>
        <Input
          type="number"
          min={1}
          max={1000}
          value={maxIterations}
          onChange={(e) =>
            onUpdate({ maxIterations: parseInt(e.target.value) || 100 })
          }
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          Safety cap. Default 100.
        </p>
      </div>
    </div>
  )
}
