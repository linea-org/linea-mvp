import type { Node, Edge } from '@xyflow/react';

const NODE_W_DEFAULT = 220;
const NODE_H_DEFAULT = 80;
const H_GAP = 80;  // horizontal gap between columns
const V_GAP = 24;  // vertical gap between nodes in the same column

export function computeAutoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Frame children have parent-relative positions — exclude them and frame nodes
  // from the BFS entirely; they'll be repositioned after their parent moves.
  const frameIds = new Set(nodes.filter((n) => n.type === 'frame').map((n) => n.id));
  const childIds = new Set(nodes.filter((n) => n.parentId).map((n) => n.id));
  const layoutNodes = nodes.filter((n) => !frameIds.has(n.id) && !childIds.has(n.id));

  if (layoutNodes.length === 0) return nodes;

  // Build adjacency list for layout nodes only
  const layoutIdSet = new Set(layoutNodes.map((n) => n.id));
  const adj: Record<string, string[]> = {};
  for (const n of layoutNodes) adj[n.id] = [];
  for (const e of edges) {
    if (layoutIdSet.has(e.source) && layoutIdSet.has(e.target))
      adj[e.source]?.push(e.target);
  }

  // BFS from start node to assign column (level)
  const startNode = layoutNodes.find((n) => n.type === 'start') ?? layoutNodes[0]!;
  const levels: Record<string, number> = { [startNode.id]: 0 };
  const queue = [startNode.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj[cur] ?? []) {
      if (levels[next] === undefined) { levels[next] = levels[cur]! + 1; queue.push(next); }
    }
  }
  // Append unreachable nodes after the last reachable level
  let maxL = Math.max(0, ...Object.values(levels));
  for (const n of layoutNodes) { if (levels[n.id] === undefined) levels[n.id] = ++maxL; }

  // Group nodes by column
  const byLevel: Record<number, Node[]> = {};
  for (const n of layoutNodes) { (byLevel[levels[n.id]!] ??= []).push(n); }

  const nodeH = (n: Node) => (n.measured?.height as number | undefined) ?? NODE_H_DEFAULT;
  const nodeW = (n: Node) => (n.measured?.width as number | undefined) ?? NODE_W_DEFAULT;

  // Compute column x positions
  const sortedLevels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  const colX: Record<number, number> = {};
  let curX = 80;
  for (const lv of sortedLevels) {
    colX[lv] = curX;
    const colWidth = Math.max(...byLevel[lv]!.map(nodeW));
    curX += colWidth + H_GAP;
  }

  // Stack nodes vertically per column, centered around y=300
  const positioned = new Map<string, { x: number; y: number }>();
  for (const lv of sortedLevels) {
    const col = byLevel[lv]!;
    const totalH = col.reduce((sum, n) => sum + nodeH(n), 0) + V_GAP * (col.length - 1);
    let y = 300 - totalH / 2;
    for (const n of col) {
      positioned.set(n.id, { x: colX[lv]!, y });
      y += nodeH(n) + V_GAP;
    }
  }

  // Recompute frame positions to wrap their children (children keep parent-relative positions)
  const FRAME_PAD = 40;
  const framePositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const frameId of frameIds) {
    const children = nodes.filter((n) => n.parentId === frameId);
    if (children.length === 0) continue;
    const absPositions = children.map((c) => {
      // Children positions are relative to the frame's current absolute position
      const frame = nodes.find((n) => n.id === frameId)!;
      return {
        x: frame.position.x + c.position.x,
        y: frame.position.y + c.position.y,
        w: (c.measured?.width as number | undefined) ?? NODE_W_DEFAULT,
        h: (c.measured?.height as number | undefined) ?? NODE_H_DEFAULT,
      };
    });
    const minX = Math.min(...absPositions.map((p) => p.x)) - FRAME_PAD;
    const minY = Math.min(...absPositions.map((p) => p.y)) - FRAME_PAD;
    const maxX = Math.max(...absPositions.map((p) => p.x + p.w)) + FRAME_PAD;
    const maxY = Math.max(...absPositions.map((p) => p.y + p.h)) + FRAME_PAD;
    framePositions.set(frameId, { x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  }

  return nodes.map((n) => {
    if (frameIds.has(n.id)) {
      const fp = framePositions.get(n.id);
      if (!fp) return n;
      return {
        ...n,
        position: { x: fp.x, y: fp.y },
        style: { ...(n.style ?? {}), width: fp.w, height: fp.h },
        data: { ...n.data, expandedHeight: fp.h },
      };
    }
    // Frame children: keep their parent-relative positions unchanged
    if (childIds.has(n.id)) return n;
    return { ...n, position: positioned.get(n.id) ?? n.position };
  });
}
