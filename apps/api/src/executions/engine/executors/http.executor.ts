import type { WorkflowState } from '../variable-substitution';
import { substituteVariables } from '../variable-substitution';
import { assertSafeUrl } from '../../../common/utils/ssrf-guard';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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
      return (
        Buffer.concat(chunks).toString('utf-8') +
        '\n[response truncated at 2 MB]'
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export async function executeHTTPNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
): Promise<any> {
  // Support both panel field names (url/method/body/headers) and legacy http-prefixed names
  const url = substituteVariables(
    nodeData.url || nodeData.httpUrl || '',
    state,
  );
  const method: string = nodeData.method || nodeData.httpMethod || 'GET';

  if (!url)
    throw new Error(
      'HTTP node: URL is required — set the URL field in the node configuration',
    );

  // If substituteVariables left a template placeholder it means the referenced variable doesn't exist
  const unresolved = url.match(/\{\{[^}]+\}\}/);
  if (unresolved) {
    throw new Error(
      `HTTP node: URL contains unresolved variable ${unresolved[0]} — ensure the variable exists in the workflow state`,
    );
  }

  await assertSafeUrl(url);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Panel stores headers as a JSON string object {"Key": "Value"}
  const rawHeaders = nodeData.headers || nodeData.httpHeaders;
  if (typeof rawHeaders === 'string' && rawHeaders.trim()) {
    try {
      const parsed = JSON.parse(rawHeaders) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) {
        if (k && v) headers[k] = substituteVariables(String(v), state);
      }
    } catch {
      // ignore invalid JSON
    }
  } else if (Array.isArray(rawHeaders)) {
    for (const h of rawHeaders) {
      if (h.key && h.value)
        headers[h.key] = substituteVariables(h.value, state);
    }
  }

  const authType = nodeData.authType || nodeData.httpAuthType;
  const authToken = nodeData.authToken || nodeData.httpAuthToken;
  if (authType === 'bearer' && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (authType === 'api-key' && authToken) {
    headers['X-API-Key'] = authToken;
  }

  const requestBody = nodeData.body || nodeData.httpBody;
  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody) {
    body = substituteVariables(requestBody, state);
  }

  // Disable automatic redirect following so we can SSRF-check the Location header
  // before following (a redirect to 169.254.x.x would bypass the initial assertSafeUrl).
  let response = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('HTTP redirect missing Location header');
    await assertSafeUrl(location);
    // 307/308 preserve method+body; 301/302/303 conventionally switch to GET
    const redirectMethod = [307, 308].includes(response.status)
      ? method
      : 'GET';
    const redirectBody = redirectMethod !== 'GET' ? body : undefined;
    response = await fetch(location, {
      method: redirectMethod,
      headers,
      body: redirectBody,
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('HTTP node: chained redirects are not supported');
    }
  }
  const rawBody = await readBodyWithLimit(response);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${rawBody.slice(0, 200)}`,
    );
  }

  // Apply response processing options
  let processedBody = rawBody;
  if (nodeData.stripHtml) {
    processedBody = stripHtmlToText(processedBody);
  }
  if (nodeData.maxChars && processedBody.length > nodeData.maxChars) {
    processedBody =
      processedBody.slice(0, nodeData.maxChars as number) + '\n[truncated]';
  }

  let data: unknown;
  try {
    data = processedBody ? JSON.parse(processedBody) : null;
  } catch {
    data = processedBody;
  }

  return { status: response.status, data, url, method };
}
