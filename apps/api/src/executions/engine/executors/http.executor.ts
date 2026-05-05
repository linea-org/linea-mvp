import type { WorkflowState } from '../variable-substitution';
import { substituteVariables } from '../variable-substitution';

export async function executeHTTPNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): Promise<any> {
  const url = substituteVariables(nodeData.httpUrl || '', state);
  const method: string = nodeData.httpMethod || 'GET';

  if (!url) throw new Error('HTTP node: URL is required');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (Array.isArray(nodeData.httpHeaders)) {
    for (const h of nodeData.httpHeaders) {
      if (h.key && h.value)
        headers[h.key] = substituteVariables(h.value, state);
    }
  }

  if (nodeData.httpAuthType === 'bearer' && nodeData.httpAuthToken) {
    headers['Authorization'] = `Bearer ${nodeData.httpAuthToken}`;
  } else if (nodeData.httpAuthType === 'api-key' && nodeData.httpAuthToken) {
    headers['X-API-Key'] = nodeData.httpAuthToken;
  }

  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(method) && nodeData.httpBody) {
    body = substituteVariables(nodeData.httpBody, state);
  }

  const response = await fetch(url, { method, headers, body });
  const rawBody = await response.text();

  let data: unknown;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = rawBody;
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${rawBody.slice(0, 200)}`,
    );
  }

  return { status: response.status, data, url, method };
}
