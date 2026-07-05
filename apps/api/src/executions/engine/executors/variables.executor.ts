import type { WorkflowState } from '../variable-substitution.js';

interface VariableEntry {
  key: string;
  value: string; // supports {{}} substitution — already resolved by the time executor runs
}

export interface VariablesNodeData {
  variables?: VariableEntry[];
}

export function executeVariablesNode(
  nodeData: VariablesNodeData,
  _state: WorkflowState,
): Record<string, unknown> {
  const entries = nodeData.variables ?? [];
  const result: Record<string, unknown> = {};

  for (const { key, value } of entries) {
    const k = key?.trim();
    if (!k) continue;
    // Try to parse as JSON for structured values, fall back to string
    try {
      result[k] = JSON.parse(value);
    } catch {
      result[k] = value;
    }
  }

  return result;
}
