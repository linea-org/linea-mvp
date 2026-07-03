export interface NodeStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'suspended' | 'divider';
  output?: unknown;
  error?: string;
  durationMs?: number;
  agentStreamedText?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'workflow' | 'system' | 'trace';
  content: string;
  typing?: boolean;
  suspended?: boolean;
  isApproval?: boolean;
  isToolApproval?: boolean;
  toolName?: string;
  toolSummary?: string;
  steps?: NodeStep[];
  simulated?: boolean;
  isError?: boolean;
}

export type ExecStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed';

export interface SuspendedState {
  question: string;
  choices?: string[];
  isApproval: boolean;
  isToolApproval?: boolean;
  toolName?: string;
  toolSummary?: string;
}

export interface SSEEvent {
  type: string;
  nodeId?: string;
  status?: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
  delta?: string;
  interrupt?: {
    type?: string;
    question?: string;
    message?: string;
    prompt?: string;
    choices?: string[];
    /** tool_approval fields */
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    summary?: string;
    step?: number;
  };
}

export interface ChatPreviewPanelProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onClose: () => void;
  /** Called when an execution is created — lets the builder connect its own SSE for canvas node badges */
  onExecutionStarted?: (execId: string) => void;
}
