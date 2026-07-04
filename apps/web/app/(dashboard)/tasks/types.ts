export interface ToolCall {
  id: string; name: string; input: Record<string, unknown>; result?: unknown;
}
export interface Attachment {
  id: string; name: string; type: 'file' | 'workflow' | 'memory' | 'connector';
  content?: string; workflowId?: string; fileType?: string; connectorId?: string;
}
export interface Message {
  id: string; role: 'user' | 'assistant'; content: string;
  toolCalls?: ToolCall[]; streaming?: boolean;
  attachments?: Attachment[]; model?: string;
}
export interface Session {
  id: string;       // threadId — used as LangGraph thread_id
  dbId?: string;    // DB row UUID — used for delete/patch API calls
  title: string;
  createdAt: number;
  messages: Message[];
}
export interface SSEEvent {
  type: string; delta?: string; id?: string; name?: string;
  input?: Record<string, unknown>; result?: unknown;
}
export interface CreatedWorkflow { id: string; name: string; podId?: string }

export interface ModelOption { id: string; label: string; hint: string; provider: string; badge?: string }
