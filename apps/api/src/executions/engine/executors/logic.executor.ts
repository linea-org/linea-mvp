import type { WorkflowState } from '../variable-substitution';

export function executeLogicNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const nodeType: string = nodeData.nodeType || '';

  if (nodeType === 'if-else' || nodeType === 'if / else') {
    const condition = nodeData.condition || 'false';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      'input',
      'state',
      'lastOutput',
      `return !!(${condition})`,
    );
    const result = fn(state.variables.input, state, state.variables.lastOutput);
    return { condition: Boolean(result), branch: result ? 'if' : 'else' };
  }

  if (nodeType === 'router') {
    const routes: Array<{ id: string; label: string; condition: string }> =
      nodeData.routes || [];
    for (const route of routes) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function(
          'input',
          'state',
          'lastOutput',
          `return !!(${route.condition})`,
        );
        if (fn(state.variables.input, state, state.variables.lastOutput)) {
          return { branch: route.id, label: route.label };
        }
      } catch {
        // continue to next route
      }
    }
    return { branch: 'none' };
  }

  return { branch: 'default' };
}
