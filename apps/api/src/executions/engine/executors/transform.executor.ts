import jexl from 'jexl';
import type { WorkflowState } from '../variable-substitution.js';

export function executeTransformNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const expression: string =
    nodeData.transformScript ||
    nodeData.transformation ||
    nodeData.expression ||
    'lastOutput';

  const context = {
    input: state.variables?.lastOutput,
    lastOutput: state.variables?.lastOutput,
    variables: state.variables ?? {},
  };

  try {
    return jexl.evalSync(expression, context);
  } catch (err) {
    throw new Error(
      `Transform expression error: ${err instanceof Error ? err.message : String(err)}. ` +
        `Use jexl expressions — e.g. "input.name", "lastOutput.count + 1", "variables.x == 'foo'".`,
    );
  }
}
