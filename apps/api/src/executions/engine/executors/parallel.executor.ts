import type { WorkflowState } from '../variable-substitution';

export interface ParallelBranch {
  id: string;
  label?: string;
  type: string;
  config: Record<string, unknown>;
}

export interface ParallelNodeData {
  branches?: ParallelBranch[];
  failFast?: boolean;
}

export interface ParallelBranchResult {
  id: string;
  label: string;
  status: 'fulfilled' | 'rejected';
  value?: unknown;
  error?: string;
}

// The actual dispatch is done by NodeExecutorService to avoid circular deps.
// This module exports types; the case in node-executor.service.ts handles execution.
export function buildParallelResults(
  branches: ParallelBranch[],
  settled: PromiseSettledResult<{ result: unknown }>[],
): { results: ParallelBranchResult[]; count: number; failed: number } {
  const results: ParallelBranchResult[] = settled.map((res, i) => ({
    id: branches[i]?.id ?? String(i),
    label: branches[i]?.label ?? `Branch ${i + 1}`,
    status: res.status,
    value: res.status === 'fulfilled' ? res.value.result : undefined,
    error: res.status === 'rejected' ? String((res as PromiseRejectedResult).reason) : undefined,
  }));

  return {
    results,
    count: results.length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}
