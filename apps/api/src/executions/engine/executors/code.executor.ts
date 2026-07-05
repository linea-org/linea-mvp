import type { WorkflowState } from '../variable-substitution.js';

export interface CodeNodeData {
  code?: string;
  language?: 'javascript';
  timeoutMs?: number;
}

/**
 * Code execution requires an isolated Pod VM for safe sandboxing.
 * This feature is disabled until Pod VM infrastructure (Kata Containers /
 * Firecracker) is available. See GitHub issue for the architecture plan.
 */
export function executeCodeNode(
  _nodeData: CodeNodeData,
  _state: WorkflowState,
): never {
  throw new Error(
    'Code node execution is currently disabled. ' +
      'Arbitrary code execution requires a dedicated Pod VM for safe sandboxing. ' +
      'This feature will be re-enabled once Pod VM infrastructure is available. ' +
      'Use the "agent" node for logic-heavy steps in the meantime.',
  );
}
