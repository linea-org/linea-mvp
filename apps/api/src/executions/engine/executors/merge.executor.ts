import type { WorkflowState } from '../variable-substitution';

export function executeMergeNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const sources: string[] = Array.isArray(nodeData.sources)
    ? nodeData.sources
    : [];
  const mode: string = nodeData.mode ?? 'concat';

  const resolved: unknown[] = sources
    .map((path: string) => {
      const p = String(path).trim();
      if (!p) return undefined;
      return state.variables[p];
    })
    .filter((v): v is unknown => v !== undefined);

  if (resolved.length === 0) {
    return state.variables.lastOutput ?? [];
  }

  switch (mode) {
    case 'concat': {
      const arrays = resolved.filter(Array.isArray) as unknown[][];
      return ([] as unknown[]).concat(...arrays);
    }
    case 'merge': {
      const objects = resolved.filter(
        (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
      );
      return Object.assign({}, ...objects);
    }
    case 'zip': {
      const arrays = resolved.filter(Array.isArray) as unknown[][];
      const maxLen =
        arrays.length > 0 ? Math.max(...arrays.map((a) => a.length)) : 0;
      return Array.from({ length: maxLen }, (_, i) => arrays.map((a) => a[i]));
    }
    default:
      return resolved;
  }
}
