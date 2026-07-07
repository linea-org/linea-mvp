import { HugeiconsIcon } from "@hugeicons/react"
import { FlowConnectionIcon } from "@hugeicons/core-free-icons"
import type { Node, Edge } from "@xyflow/react"

export function ConnectionsTab({
  node,
  nodes,
  edges,
}: {
  node: Node
  nodes: Node[]
  edges: Edge[]
}) {
  const incoming = edges.filter((e) => e.target === node.id)
  const outgoing = edges.filter((e) => e.source === node.id)

  function nodeName(id: string) {
    const n = nodes.find((x) => x.id === id)
    return (
      (n?.data?.nodeName as string) ??
      (n?.data?.label as string) ??
      n?.type ??
      id
    )
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <HugeiconsIcon
          icon={FlowConnectionIcon}
          className="mb-3 size-8 text-muted-foreground/30"
        />
        <p className="text-xs text-muted-foreground">No connections yet.</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/60">
          Draw edges to connect this node.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3">
      {incoming.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Inputs
          </p>
          <div className="space-y-1">
            {incoming.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                <span className="flex-1 truncate font-medium text-foreground">
                  {nodeName(e.source)}
                </span>
                {e.sourceHandle && (
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {e.sourceHandle}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Outputs
          </p>
          <div className="space-y-1">
            {outgoing.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs"
              >
                <span className="flex-1 truncate font-medium text-foreground">
                  {nodeName(e.target)}
                </span>
                {e.sourceHandle && (
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {e.sourceHandle}
                  </span>
                )}
                <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
