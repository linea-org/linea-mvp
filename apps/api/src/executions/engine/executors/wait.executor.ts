import type { WorkflowState } from '../variable-substitution.js';

export interface WaitNodeData {
  duration?: number;
  unit?: 'ms' | 's' | 'm' | 'h';
}

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};

const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes hard cap

export async function executeWaitNode(
  nodeData: WaitNodeData,
  _state: WorkflowState,
): Promise<{ waited: number; unit: string }> {
  const unit = nodeData.unit ?? 's';
  const raw = Number(nodeData.duration ?? 1);
  const ms = Math.min(raw * (UNIT_MS[unit] ?? 1_000), MAX_WAIT_MS);

  await new Promise((resolve) => setTimeout(resolve, ms));

  return { waited: ms, unit };
}
