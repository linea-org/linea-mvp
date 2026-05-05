import type { WorkflowState } from '../variable-substitution';

export function executeTransformNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const script =
    nodeData.transformScript || nodeData.transformation || 'return lastOutput;';
  const lastOutput = state.variables?.lastOutput;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('lastOutput', 'state', 'variables', script);
  return fn(lastOutput, state, state.variables);
}
