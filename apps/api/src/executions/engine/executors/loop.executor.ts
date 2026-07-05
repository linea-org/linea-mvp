import jexl from 'jexl';
import type { WorkflowState } from '../variable-substitution.js';

export interface LoopNodeData {
  arrayPath?: string;
  itemTransform?: string;
  maxIterations?: number;
  children?: string[];
}

export interface LoopOutput {
  results: unknown[];
  total: number;
  items: unknown[];
}

export const MAX_LOOP_TIMEOUT_MS = 5 * 60 * 1000;

export function checkLoopTimeout(
  startMs: number,
  iterationIndex: number,
): void {
  if (Date.now() - startMs > MAX_LOOP_TIMEOUT_MS) {
    throw new Error(
      `Loop exceeded maximum duration of 5 minutes after ${iterationIndex} iteration${iterationIndex === 1 ? '' : 's'}.`,
    );
  }
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
): LoopOutput {
  const maxIterations = nodeData.maxIterations ?? 100;

  let items: unknown[] = [];
  if (nodeData.arrayPath?.trim()) {
    let resolved = resolveByPath(state.variables, nodeData.arrayPath);

    // substituteInValue may have already resolved the path to a JSON string (e.g. "[1,2,3]")
    // Try to parse it as JSON if path resolution returned nothing
    if (resolved === undefined) {
      const trimmed = nodeData.arrayPath.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          resolved = JSON.parse(trimmed);
        } catch {
          /* keep undefined */
        }
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
        return jexl.evalSync(expr, { item });
      } catch {
        return item;
      }
    });
  } else {
    results = items;
  }

  return { results, total: results.length, items };
}
