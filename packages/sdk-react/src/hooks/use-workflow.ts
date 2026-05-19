'use client';

import { useCallback, useState } from 'react';
import { useLineaContext } from '../context';
import type { Execution, TriggerOptions, WaitOptions } from '@linea/sdk';

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface WorkflowState {
  status: WorkflowStatus;
  execution: Execution | null;
  error: string | null;
}

export interface UseWorkflowReturn extends WorkflowState {
  /** Trigger the workflow and wait for completion. Returns the final execution. */
  run: (options: TriggerOptions, waitOptions?: WaitOptions) => Promise<Execution>;
  /** Reset state back to idle */
  reset: () => void;
}

export function useWorkflow(): UseWorkflowReturn {
  const { client } = useLineaContext();
  const [state, setState] = useState<WorkflowState>({
    status: 'idle',
    execution: null,
    error: null,
  });

  const run = useCallback(
    async (options: TriggerOptions, waitOptions?: WaitOptions): Promise<Execution> => {
      setState({ status: 'running', execution: null, error: null });
      try {
        const execution = await client.run(options, waitOptions);
        setState({ status: 'completed', execution, error: null });
        return execution;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'failed', execution: null, error: message });
        throw err;
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', execution: null, error: null });
  }, []);

  return { ...state, run, reset };
}
