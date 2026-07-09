"use client"

import { memo } from "react"
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { NodeShell, TARGET_CLS } from "./node-shell"

export const EndNode = memo(function EndNode({
  id,
  data,
  selected,
}: NodeProps) {
  const { setNodes } = useReactFlow()
  const label = (data.nodeName as string) ?? (data.label as string) ?? "End"
  const posLocked = (data.positionLocked as boolean) ?? false
  const delLocked = (data.deleteLocked as boolean) ?? false
  const portsVertical = (data.portsVertical as boolean) ?? false
  const inPos = portsVertical ? Position.Top : Position.Left

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
      nodeType="end"
      label={label}
      selected={!!selected}
      properties={[]}
      posLocked={posLocked}
      delLocked={delLocked}
      portsVertical={portsVertical}
      onTogglePorts={togglePorts}
    >
      <Handle type="target" position={inPos} className={TARGET_CLS} />
    </NodeShell>
  )
})
