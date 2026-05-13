import type { WorkflowState } from '../variable-substitution';

export interface McpNodeData {
  mcpServerId?: string;
  mcpServerUrl?: string;
  mcpAction?: string;        // tool name to call
  mcpParams?: unknown;       // JSON params for the tool
  outputField?: string;      // 'full' | 'text' | 'json' | 'markdown'
  accessToken?: string;
}

const HTTP_TIMEOUT_MS = 30_000;

export async function executeMcpNode(
  nodeData: McpNodeData,
  _state: WorkflowState,
  serverUrl?: string,
  accessToken?: string,
): Promise<unknown> {
  const url = serverUrl ?? nodeData.mcpServerUrl;
  if (!url) throw new Error('MCP node: no server URL configured');

  const toolName = nodeData.mcpAction;
  if (!toolName) throw new Error('MCP node: no tool name (mcpAction) configured');

  let params: Record<string, unknown> = {};
  if (nodeData.mcpParams) {
    if (typeof nodeData.mcpParams === 'string') {
      try {
        params = JSON.parse(nodeData.mcpParams);
      } catch {
        throw new Error(`MCP node: mcpParams is not valid JSON: ${nodeData.mcpParams}`);
      }
    } else {
      params = nodeData.mcpParams as Record<string, unknown>;
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = accessToken ?? nodeData.accessToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  let result: unknown;
  try {
    // MCP JSON-RPC 2.0 call_tool request
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: params },
    });

    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP server returned ${res.status}: ${text}`);
    }

    const json = await res.json() as { result?: unknown; error?: { message: string } };

    if (json.error) throw new Error(`MCP tool error: ${json.error.message}`);

    result = json.result;
  } finally {
    clearTimeout(timer);
  }

  return extractField(result, nodeData.outputField ?? 'full');
}

function extractField(data: unknown, field: string): unknown {
  if (field === 'full' || !data) return data;

  const obj = data as Record<string, unknown>;

  switch (field) {
    case 'text':
      if (typeof data === 'string') return data;
      if (Array.isArray(obj['content'])) {
        const textPart = (obj['content'] as Array<{ type: string; text: string }>)
          .find((c) => c.type === 'text');
        return textPart?.text ?? JSON.stringify(data);
      }
      return JSON.stringify(data);

    case 'markdown':
      return obj['markdown'] ?? extractField(data, 'text');

    case 'json':
      return obj['json'] ?? obj['data'] ?? data;

    default:
      return obj[field] ?? data;
  }
}
