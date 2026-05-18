import { createContext, Script } from 'vm';
import type { WorkflowState } from '../variable-substitution';

export interface LoopNodeData {
  arrayPath?: string;
  itemTransform?: string;
  maxIterations?: number;
}

function resolveByPath(
  variables: Record<string, unknown>,
  path: string,
): unknown {
  const clean = path.trim().replace(/^\{\{(.+?)\}\}$/, '$1');
  return clean
    .split('.')
    .reduce((cur: unknown, k) => (cur as any)?.[k], variables);
}

export function executeLoopNode(
  nodeData: LoopNodeData,
  state: WorkflowState,
): { results: unknown[]; total: number; items: unknown[] } {
  const maxIterations = nodeData.maxIterations ?? 100;

  let items: unknown[] = [];
  if (nodeData.arrayPath?.trim()) {
    let resolved = resolveByPath(state.variables, nodeData.arrayPath);

    // substituteInValue may have already resolved the path to a JSON string (e.g. "[1,2,3]")
    // Try to parse it as JSON if path resolution returned nothing
    if (resolved === undefined) {
      const trimmed = nodeData.arrayPath.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try { resolved = JSON.parse(trimmed); } catch { /* keep undefined */ }
      }
    }

    if (Array.isArray(resolved)) {
      items = resolved.slice(0, maxIterations);
    } else if (resolved !== undefined && resolved !== null) {
      items = [resolved];
    }
  }

  let results: unknown[];

  if (nodeData.itemTransform?.trim()) {
    const expr = nodeData.itemTransform.trim();
    results = items.map((item) => {
      try {
        const sandbox: Record<string, unknown> = {
          item,
          result: undefined,
          JSON,
          Math,
          Object,
          Array,
          String,
          Number,
          Boolean,
        };
        const ctx = createContext(sandbox);
        const script = new Script(
          `result = (function() { return (${expr}); })()`,
        );
        script.runInContext(ctx, { timeout: 1000 });
        return sandbox['result'];
      } catch {
        return item;
      }
    });
  } else {
    results = items;
  }

  return { results, total: results.length, items };
}
