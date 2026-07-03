import { HugeiconsIcon } from '@hugeicons/react';
import { FlowConnectionIcon } from '@hugeicons/core-free-icons';
import type { Node, Edge } from '@xyflow/react';

export function ConnectionsTab({ node, nodes, edges }: { node: Node; nodes: Node[]; edges: Edge[] }) {
  const incoming = edges.filter((e) => e.target === node.id);
  const outgoing = edges.filter((e) => e.source === node.id);

  function nodeName(id: string) {
    const n = nodes.find((x) => x.id === id);
    return (n?.data?.nodeName as string) ?? (n?.data?.label as string) ?? n?.type ?? id;
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <HugeiconsIcon icon={FlowConnectionIcon} className="size-8 text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground">No connections yet.</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">Draw edges to connect this node.</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {incoming.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Inputs</p>
          <div className="space-y-1">
            {incoming.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                <span className="flex-1 truncate text-foreground font-medium">{nodeName(e.source)}</span>
                {e.sourceHandle && (
                  <span className="text-[10px] text-muted-foreground rounded-full border border-border px-1.5 py-0.5 font-mono shrink-0">
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Outputs</p>
          <div className="space-y-1">
            {outgoing.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
                <span className="flex-1 truncate text-foreground font-medium">{nodeName(e.target)}</span>
                {e.sourceHandle && (
                  <span className="text-[10px] text-muted-foreground rounded-full border border-border px-1.5 py-0.5 font-mono shrink-0">
                    {e.sourceHandle}
                  </span>
                )}
                <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
