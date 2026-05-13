export const EXECUTION_QUEUE = 'executions';

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  workspaceId: string;
  input: Record<string, any>;
  threadId: string;
  resumeValue?: unknown; // set when resuming after a human interrupt
  preloadedState?: {     // set when replaying from a specific node
    variables: Record<string, any>;
    nodeResults: Record<string, any>; // entries with __preloaded:true are fast-forwarded
  };
}
