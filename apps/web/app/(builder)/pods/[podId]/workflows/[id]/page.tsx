"use client"

import { useParams } from "next/navigation"
import { useWorkspace } from "@/contexts/workspace-context"
import { WorkflowBuilder } from "@/components/workflow-builder"

export default function WorkflowBuilderPage() {
  const { podId, id } = useParams<{ podId: string; id: string }>()
  const { activeWorkspace } = useWorkspace()

  if (!activeWorkspace) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    )
  }

  return (
    <WorkflowBuilder
      workflowId={id}
      podId={podId}
      workspaceId={activeWorkspace.id}
    />
  )
}
