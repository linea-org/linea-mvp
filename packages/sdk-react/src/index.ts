// Context / Provider
export { LineaProvider } from './context';
export type { LineaProviderProps } from './context';

// Hooks
export { useWorkflow } from './hooks/use-workflow';
export type {
  WorkflowStatus,
  WorkflowState,
  UseWorkflowReturn,
  NodeEvent,
  Interrupt,
  SuspensionState,
  RespondOptions,
} from './hooks/use-workflow';

export { useAgent } from './hooks/use-agent';
export type { AgentMessage, UseAgentOptions, UseAgentReturn, ToolCall } from './hooks/use-agent';

// Pre-built components
export { WorkflowRunner } from './components/workflow-runner';
export type { WorkflowRunnerProps, WorkflowInputField } from './components/workflow-runner';

export { LineaChat } from './components/linea-chat';
export type { LineaChatProps } from './components/linea-chat';

// Re-export core SDK types so consumers don't need @linea/sdk directly
export type {
  Execution,
  ExecutionStatus,
  TriggerOptions,
  WaitOptions,
} from '@linea/sdk';
