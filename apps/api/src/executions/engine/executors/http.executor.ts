import type { WorkflowState } from '../variable-substitution';
import { substituteVariables } from '../variable-substitution';
import { assertSafeUrl } from '../../../common/utils/ssrf-guard';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB

async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      reader.cancel().catch(() => {});
      return Buffer.concat(chunks).toString('utf-8') + '\n[response truncated at 2 MB]';
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export async function executeHTTPNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): Promise<any> {
  const url = substituteVariables(nodeData.httpUrl || '', state);
  const method: string = nodeData.httpMethod || 'GET';

  if (!url) throw new Error('HTTP node: URL is required');

  await assertSafeUrl(url);

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
  const rawBody = await readBodyWithLimit(response);

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
