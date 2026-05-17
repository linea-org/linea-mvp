import jexl from 'jexl';
import type { WorkflowState } from '../variable-substitution';

function evalCondition(condition: string, state: WorkflowState): boolean {
  const context = {
    input: state.variables?.input,
    lastOutput: state.variables?.lastOutput,
    variables: state.variables ?? {},
  };
  try {
    return Boolean(jexl.evalSync(condition, context));
  } catch {
    return false;
  }
}

export function executeLogicNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const nodeType: string = nodeData.nodeType || '';

  if (nodeType === 'if-else' || nodeType === 'if / else') {
    const condition = nodeData.condition || 'false';
    const result = evalCondition(condition, state);
    // Branch values match the ReactFlow handle IDs ("true"/"false") on the custom-node
    return { condition: result, branch: result ? 'true' : 'false' };
  }

  if (nodeType === 'router') {
    const routes: Array<{ id?: string; label: string; condition: string }> =
      nodeData.routes || [];
    for (const [i, route] of routes.entries()) {
      if (evalCondition(route.condition, state)) {
        // id must match the ReactFlow handle id on the custom-node (falls back to route-{i})
        return { branch: route.id ?? `route-${i}`, label: route.label };
      }
    }
    return { branch: 'none' };
  }

  return { branch: 'default' };
}
