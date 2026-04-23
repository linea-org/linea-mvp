// Shared JSON structure types used in jsonb columns.
// Kept here to avoid importing from @linea/types (which would create a circular dep).

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  label?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings?: Record<string, unknown>;
}

export interface NodeResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  tokenUsage?: { input: number; output: number };
}
