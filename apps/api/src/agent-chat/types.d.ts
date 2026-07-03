import { ModelClient } from 'src/services/ai/clients/interface';

export type AgentEvent =
  | TextDeltaEvent
  | ProgressEvent
  | StepStartEvent
  | StepEndEvent
  | ToolCallEvent
  | ToolResultEvent
  | ErrorEvent
  | DoneEvent;

export interface AgentContext {
  workspaceId: string;
  threadId: string;
  dto: ChatDto;
  model: string;
  system: string;
  client: ModelClient;
  emit(event: AgentEvent): void;
}

export interface ProgressEvent {
  type: 'progress';
  message: string;
}
export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface StepStartEvent {
  type: 'step_start';
  id: string;
  name: string;
}

export interface StepEndEvent {
  type: 'step_end';
  id: string;
  name: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  name: string;
  result: unknown;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface DoneEvent {
  type: 'done';
}
