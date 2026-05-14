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
    return { condition: result, branch: result ? 'if' : 'else' };
  }

  if (nodeType === 'router') {
    const routes: Array<{ id: string; label: string; condition: string }> =
      nodeData.routes || [];
    for (const route of routes) {
      if (evalCondition(route.condition, state)) {
        return { branch: route.id, label: route.label };
      }
    }
    return { branch: 'none' };
  }

  return { branch: 'default' };
}
