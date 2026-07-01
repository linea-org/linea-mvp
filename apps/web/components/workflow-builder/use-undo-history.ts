import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Node, Edge } from '@xyflow/react';

/**
 * Snapshot-based undo/redo for the canvas. Callers push a snapshot after every
 * committed mutation (node/edge add, move, delete, etc.); undo/redo replay
 * snapshots directly rather than computing inverse operations.
 */
export function useUndoHistory(
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
) {
  const historyStackRef = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const historyIdxRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((ns: Node[], es: Edge[]) => {
    historyStackRef.current = historyStackRef.current.slice(0, historyIdxRef.current + 1);
    historyStackRef.current.push({ nodes: ns.map((n) => ({ ...n })), edges: es.map((e) => ({ ...e })) });
    historyIdxRef.current = historyStackRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const snap = historyStackRef.current[historyIdxRef.current]!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyStackRef.current.length - 1) return;
    historyIdxRef.current++;
    const snap = historyStackRef.current[historyIdxRef.current]!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyStackRef.current.length - 1);
  }, [setNodes, setEdges]);

  return { canUndo, canRedo, pushHistory, undo, redo };
}
