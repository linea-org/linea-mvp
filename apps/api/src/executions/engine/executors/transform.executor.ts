import { Parser } from 'expr-eval';
import type { WorkflowState } from '../variable-substitution';

const parser = new Parser({ operators: { assignment: false } });

export function executeTransformNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): any {
  const expression: string =
    nodeData.transformScript || nodeData.transformation || 'lastOutput';

  const context = {
    input: state.variables?.lastOutput,
    lastOutput: state.variables?.lastOutput,
    variables: state.variables ?? {},
  };

  try {
    return parser.evaluate(expression, context);
  } catch (err) {
    throw new Error(
      `Transform expression error: ${err instanceof Error ? err.message : String(err)}. ` +
      `Use simple expressions (e.g. "input.name", "lastOutput.count + 1"). ` +
      `Full code execution requires a Pod VM (coming soon).`,
    );
  }
}
