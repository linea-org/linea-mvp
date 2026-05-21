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
    const routes: Array<{ id?: string; label: string; condition: string; isDefault?: boolean }> =
      nodeData.routes || [];
    let defaultRoute: (typeof routes)[number] | undefined;

    for (const [i, route] of routes.entries()) {
      if (route.isDefault) { defaultRoute = route; continue; }
      if (evalCondition(route.condition, state)) {
        return { branch: route.id ?? `route-${i}`, label: route.label };
      }
    }

    // Fall back to the designated default route if one exists
    if (defaultRoute) {
      const i = routes.indexOf(defaultRoute);
      return { branch: defaultRoute.id ?? `route-${i}`, label: defaultRoute.label };
    }

    throw new Error(
      'Router: no route condition matched and no default route is configured. ' +
        'Add a default route or ensure at least one condition always matches.',
    );
  }

  return { branch: 'default' };
}
