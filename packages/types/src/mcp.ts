import type { ID, Timestamp } from './common.js';

export type MCPAuthType = 'none' | 'api_key' | 'bearer' | 'oauth';
export type MCPServerStatus = 'unknown' | 'connected' | 'error';

export interface MCPServer {
  id: ID;
  workspaceId: ID;
  name: string;
  url: string;
  authType: MCPAuthType;
  status: MCPServerStatus;
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface MCPTool {
  id: ID;
  mcpServerId: ID;
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  createdAt: Timestamp;
}
