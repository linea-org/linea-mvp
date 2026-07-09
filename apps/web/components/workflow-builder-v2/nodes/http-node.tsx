"use client"

import { memo } from "react"
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { NodeShell, TARGET_CLS, SOURCE_CLS, fmt } from "./node-shell"

export const HttpNode = memo(function HttpNode({
  id,
  data,
  selected,
}: NodeProps) {
  const { setNodes } = useReactFlow()

  const nodeType = "http"
  const label = (data.nodeName as string) ?? (data.label as string) ?? "HTTP"
  const status = data.status as string | undefined
  const posLocked = (data.positionLocked as boolean) ?? false
  const delLocked = (data.deleteLocked as boolean) ?? false
  const portsVertical = (data.portsVertical as boolean) ?? false
  const outputPreview = data._outputPreview as string | undefined

  const properties = []
  if (data.method) properties.push({ key: "method", value: fmt(data.method) })
  if (data.url) properties.push({ key: "url", value: fmt(data.url, 22) })

  const inPos = portsVertical ? Position.Top : Position.Left
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
      nodeType={nodeType}
      label={label}
      status={status}
      selected={!!selected}
      properties={properties}
      posLocked={posLocked}
      delLocked={delLocked}
      portsVertical={portsVertical}
      onTogglePorts={togglePorts}
      outputPreview={outputPreview}
    >
      <Handle type="target" position={inPos} className={TARGET_CLS} />
      <Handle type="source" position={outPos} className={SOURCE_CLS} />
    </NodeShell>
  )
})
