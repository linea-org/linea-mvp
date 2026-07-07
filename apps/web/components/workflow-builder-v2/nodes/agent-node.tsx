"use client"

import { memo } from "react"
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { NodeShell, TARGET_CLS, SOURCE_CLS, fmt } from "./node-shell"

export const AgentNode = memo(function AgentNode({
  id,
  data,
  selected,
}: NodeProps) {
  const { setNodes } = useReactFlow()

  const nodeType = "agent"
  const label = (data.nodeName as string) ?? (data.label as string) ?? "Agent"
  const status = data.status as string | undefined
  const posLocked = (data.positionLocked as boolean) ?? false
  const delLocked = (data.deleteLocked as boolean) ?? false
  const portsVertical = (data.portsVertical as boolean) ?? false
  const outputPreview = data._outputPreview as string | undefined

  const properties = []
  if (data.model) properties.push({ key: "model", value: fmt(data.model) })
  const instr = data.systemPrompt as string
  if (instr) properties.push({ key: "prompt", value: fmt(instr, 22) })
  const toolCount = Array.isArray(data.tools) ? data.tools.length : 0
  if (toolCount > 0) properties.push({ key: "tools", value: String(toolCount) })

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
