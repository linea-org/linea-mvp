import type {
  Execution,
  LineaClientOptions,
  SSEEvent,
  TriggerOptions,
  WaitOptions,
} from './types';

const DEFAULT_BASE_URL = 'https://api.linea.io/v1';
const DEFAULT_POLL_INTERVAL = 2_000;
const DEFAULT_TIMEOUT = 300_000;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export class LineaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: LineaClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  /** Trigger a workflow execution and return immediately. */
  async trigger(options: TriggerOptions): Promise<Execution> {
    const { workspaceId, podId, workflowId, input = {} } = options;
    return this.post<Execution>(
      `/workspaces/${workspaceId}/pods/${podId}/executions`,
      { workflowId, input },
    );
  }

  /** Fetch a single execution by ID. */
  async getExecution(
    workspaceId: string,
    podId: string,
    executionId: string,
  ): Promise<Execution> {
    return this.get<Execution>(
      `/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}`,
    );
  }

  /**
   * Poll until the execution reaches a terminal status (completed / failed / cancelled).
   * Throws if the execution fails or the timeout is exceeded.
   */
  async waitForCompletion(
    workspaceId: string,
    podId: string,
    executionId: string,
    options: WaitOptions = {},
  ): Promise<Execution> {
    const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const execution = await this.getExecution(workspaceId, podId, executionId);
      if (TERMINAL_STATUSES.has(execution.status)) {
        if (execution.status === 'failed') {
          throw new LineaExecutionError(execution.error ?? 'Execution failed', execution);
        }
        return execution;
      }
      await sleep(pollInterval);
    }

    throw new LineaTimeoutError(
      `Execution ${executionId} did not complete within ${timeout}ms`,
    );
  }

  /**
   * Trigger a workflow and wait for it to complete in one call.
   * Throws if the execution fails or times out.
   */
  async run(
    options: TriggerOptions,
    waitOptions: WaitOptions = {},
  ): Promise<Execution> {
    const execution = await this.trigger(options);
    return this.waitForCompletion(
      options.workspaceId,
      options.podId,
      execution.id,
      waitOptions,
    );
  }

  /**
   * Stream SSE events for a running execution.
   * Returns a cleanup function that aborts the stream.
   *
   * @example
   * const stop = client.streamEvents(wsId, podId, execId, (event) => {
   *   if (event.type === 'execution_complete') console.log(event.output);
   * });
   * // later: stop();
   */
  streamEvents(
    workspaceId: string,
    podId: string,
    executionId: string,
    onEvent: (event: SSEEvent) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const controller = new AbortController();
    const url = `${this.baseUrl}/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/events`;

    void (async () => {
      try {
        const resp = await fetch(url, {
          headers: { 'x-api-key': this.apiKey },
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`SSE connection failed: ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              onEvent(JSON.parse(line.slice(6)) as SSEEvent);
            } catch {
              // skip unparseable frames
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => controller.abort();
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await resp.json() as { data?: T; error?: { message: string } };

    if (!resp.ok) {
      throw new LineaApiError(
        json.error?.message ?? `Request failed: ${resp.status}`,
        resp.status,
      );
    }

    return (json.data ?? json) as T;
  }
}

export class LineaApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'LineaApiError';
  }
}

export class LineaExecutionError extends Error {
  constructor(
    message: string,
    public readonly execution: Execution,
  ) {
    super(message);
    this.name = 'LineaExecutionError';
  }
}

export class LineaTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineaTimeoutError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
