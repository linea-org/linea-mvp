"use client"

import { memo } from "react"
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { NodeShell, TARGET_CLS, SOURCE_CLS } from "./node-shell"

export const StartNode = memo(function StartNode({
  id,
  data,
  selected,
}: NodeProps) {
  const { setNodes } = useReactFlow()
  const label = (data.nodeName as string) ?? (data.label as string) ?? "Start"
  const posLocked = (data.positionLocked as boolean) ?? false
  const delLocked = (data.deleteLocked as boolean) ?? false
  const portsVertical = (data.portsVertical as boolean) ?? false
  const outputPreview = data._outputPreview as string | undefined
  const properties: Array<{ key: string; value: string }> = []
  const outPos = portsVertical ? Position.Bottom : Position.Right

  function togglePorts() {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, portsVertical: !portsVertical } }
          : n
      )
    )
  }

  return (
    <NodeShell
      nodeType="start"
      label={label}
      selected={!!selected}
      properties={properties}
      posLocked={posLocked}
      delLocked={delLocked}
      portsVertical={portsVertical}
      onTogglePorts={togglePorts}
      outputPreview={outputPreview}
    >
      <Handle type="source" position={outPos} className={SOURCE_CLS} />
    </NodeShell>
  )
})
