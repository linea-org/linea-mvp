const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
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
