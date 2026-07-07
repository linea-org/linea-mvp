export interface WFNode {
  id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>;
  style?: Record<string, unknown>;
  parentId?: string;
  extent?: string;
  zIndex?: number;
}
export interface WFEdge {
  id: string; source: string; target: string;
  sourceHandle?: string; targetHandle?: string; label?: string;
}
export interface Workflow {
  id: string; name: string; description?: string;
  definition: { startNode: string; nodes: WFNode[]; edges: WFEdge[] }; podId: string;
  deployedAt?: string | null;
}
export interface WorkflowBuilderProps {
  workflowId: string; podId: string; workspaceId: string;
}

export type EvalOperator = 'equals' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt' | 'llm_judge' | 'tool_called' | 'tool_not_called' | 'semantic_match';
export interface EvalTestCase {
  id: string;
  name: string;
  input: string;
  assertions: { source?: string; path: string; operator: EvalOperator; expected: string; rubric?: string; reference?: string; threshold?: string }[];
  trials?: number;
  scriptedResponses?: { type: 'answer' | 'approve' | 'deny'; value: string }[];
}

export interface SSEEvent {
  type: string;
  nodeId?: string;
  status?: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
  delta?: string;
  interrupt?: { type?: string; nodeId?: string; message?: string; prompt?: string; question?: string };
}

export interface NodeResult {
  status: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
  startedAt?: number;
}
