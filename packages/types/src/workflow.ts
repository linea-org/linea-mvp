import type { ID, Timestamp } from './common';

// ─── Node Types ──────────────────────────────────────────────────────────────

export type NodeType =
  | 'start'
  | 'end'
  | 'agent'
  | 'mcp'
  | 'if-else'
  | 'while-loop'
  | 'router'
  | 'user-approval'
  | 'transform'
  | 'set-state'
  | 'guardrails'
  | 'http'
  | 'memory'
  | 'extract'
  | 'retriever'
  | 'note';

export interface WorkflowNode {
  id: string;
  type: NodeType;
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

export interface WorkflowSettings {
  maxIterations?: number;
  timeout?: number;
  maxTokens?: number;
  snapToGrid?: boolean;
  webhookOnSuccess?: string;
  webhookOnFailure?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings?: WorkflowSettings;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface Workflow {
  id: ID;
  workspaceId: ID;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  isTemplate: boolean;
  isPublic: boolean;
  version: number;
  deployedAt: Timestamp | null;
  createdBy: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkflowVersion {
  id: ID;
  workflowId: ID;
  version: number;
  definition: WorkflowDefinition;
  createdBy: ID | null;
  createdAt: Timestamp;
}

export interface Template {
  id: ID;
  category: string;
  name: string;
  description: string | null;
  workflowId: ID | null;
  thumbnailUrl: string | null;
  downloads: number;
  featured: boolean;
  createdAt: Timestamp;
}
