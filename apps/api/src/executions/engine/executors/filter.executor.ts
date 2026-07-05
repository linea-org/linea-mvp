import jexl from 'jexl';
import type { WorkflowState } from '../variable-substitution.js';

export function executeFilterNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const source: unknown = nodeData.source
    ? state.variables[nodeData.source as string]
    : state.variables.lastOutput;

  if (!Array.isArray(source)) {
    throw new Error(
      `Filter node: source must be an array (got ${typeof source}). ` +
        `Set the Source field to the variable path holding your array.`,
    );
  }

  const condition: string = nodeData.condition || 'true';

  return source.filter((item: unknown, index: number) => {
    const ctx = { item, index, variables: state.variables };
    try {
      return !!jexl.evalSync(condition, ctx);
    } catch {
      return false;
    }
  });
}
