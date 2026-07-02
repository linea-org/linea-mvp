export const API_ORIGIN = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
export const API_BASE = `${API_ORIGIN}/v1`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function friendlyApiErrorFromStatus(status: number): string | null {
  if (status === 401) return 'Your session expired. Refresh the page.';
  if (status === 402) return 'Execution limit reached. Upgrade your plan.';
  if (status === 429) return "You've hit the rate limit. Wait a moment and try again.";
  if (status >= 500) return 'Server error. Try again in a moment.';
  return null;
}

export function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const mapped = friendlyApiErrorFromStatus(err.status);
    if (mapped) return mapped;
  }
  if (err instanceof TypeError && (
    err.message.toLowerCase().includes('fetch') ||
    err.message.toLowerCase().includes('load failed')
  )) {
    return 'Connection failed. Check your internet.';
  }
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json() as { message?: string; error?: { message?: string } };
      message = body?.error?.message ?? body?.message ?? message;
    } catch {
      // use statusText if body is not JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const json = await res.json();
  return (json as { data: T }).data;
}

/**
 * Some list endpoints return a bare array, others wrap it in `{ [key]: [...] }`.
 * Normalizes both known shapes to a plain array; throws on anything else so a
 * genuinely broken response surfaces instead of silently becoming an empty list.
 */
export function unwrapList<T>(res: T[] | { [key: string]: unknown }, key: string): T[] {
  if (Array.isArray(res)) return res;
  const list = res[key];
  if (Array.isArray(list)) return list as T[];
  throw new Error(`Expected an array or { ${key}: [...] }, got: ${JSON.stringify(res)}`);
}

export function createApiClient(token: string) {
  return {
    get: <T>(path: string) => request<T>(path, token),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, token, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, token, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path: string) => request<void>(path, token, { method: 'DELETE' }),
  };
}
