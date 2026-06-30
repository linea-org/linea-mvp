import { executeTool } from './tool-executor';
import type { WorkflowState } from '../variable-substitution';
import type { ToolCallRequest } from './tool-executor';

const baseState: WorkflowState = {
  variables: {},
  chatHistory: [],
  memory: {},
};

function req(name: string, args: Record<string, any> = {}): ToolCallRequest {
  return { id: 'tc1', name, arguments: args };
}

// ─── read_variable ────────────────────────────────────────────────────────────

describe('read_variable', () => {
  it('returns the value from state.variables', async () => {
    const state: WorkflowState = {
      ...baseState,
      variables: { myVar: 'hello' },
    };
    const result = await executeTool(
      req('read_variable', { name: 'myVar' }),
      state,
    );
    expect(result.output).toBe('hello');
    expect(result.error).toBeUndefined();
  });

  it('returns null for a missing variable', async () => {
    const result = await executeTool(
      req('read_variable', { name: 'missing' }),
      baseState,
    );
    expect(result.output).toBeNull();
  });
});

// ─── write_variable ───────────────────────────────────────────────────────────

describe('write_variable', () => {
  it('returns a __writeVariable marker', async () => {
    const result = await executeTool(
      req('write_variable', { name: 'x', value: '42' }),
      baseState,
    );
    expect(result.output).toMatchObject({
      __writeVariable: { name: 'x', value: 42 },
    });
  });

  it('JSON-parses string values', async () => {
    const result = await executeTool(
      req('write_variable', { name: 'obj', value: '{"a":1}' }),
      baseState,
    );
    expect((result.output as any).__writeVariable.value).toEqual({ a: 1 });
  });

  it('keeps plain strings that are not JSON', async () => {
    const result = await executeTool(
      req('write_variable', { name: 'msg', value: 'plain text' }),
      baseState,
    );
    expect((result.output as any).__writeVariable.value).toBe('plain text');
  });
});

// ─── run_javascript ───────────────────────────────────────────────────────────

describe('run_javascript', () => {
  it('is disabled and returns an error', async () => {
    const result = await executeTool(
      req('run_javascript', { code: 'return 2 + 2;' }),
      baseState,
    );
    expect(result.error).toContain('run_javascript is disabled');
    expect(result.output).toBeNull();
  });
});

// ─── memory_store / memory_search ─────────────────────────────────────────────

describe('memory_store', () => {
  it('returns a __memoryWrite marker', async () => {
    const result = await executeTool(
      req('memory_store', { key: 'k', value: 'v' }),
      baseState,
    );
    expect(result.output).toMatchObject({
      __memoryWrite: { key: 'k', value: 'v' },
    });
  });

  it('calls memoryStore callback when context is provided', async () => {
    const storeMock = jest.fn().mockResolvedValue(undefined);
    const ctx = { memoryStore: storeMock };
    await executeTool(
      req('memory_store', { key: 'fact', value: 'hello' }),
      baseState,
      ctx,
    );
    expect(storeMock).toHaveBeenCalledWith('fact', 'hello');
  });
});

describe('memory_search', () => {
  it('finds matching keys via in-memory fallback (no context)', async () => {
    const state: WorkflowState = {
      ...baseState,
      memory: { username: 'Alice', age: 30 },
    };
    const result = await executeTool(
      req('memory_search', { query: 'user' }),
      state,
    );
    const out = result.output as { results: any[]; count: number };
    expect(out.count).toBe(1);
    expect(out.results[0].key).toBe('username');
    expect(out.results[0].score).toBe(0.5);
  });

  it('returns empty results when no match (in-memory fallback)', async () => {
    const state: WorkflowState = { ...baseState, memory: { foo: 'bar' } };
    const result = await executeTool(
      req('memory_search', { query: 'xyz' }),
      state,
    );
    const out = result.output as { results: any[]; count: number };
    expect(out.count).toBe(0);
  });

  it('uses memorySearch callback when context is provided', async () => {
    const searchMock = jest
      .fn()
      .mockResolvedValue([
        { key: 'preference', value: 'dark mode', score: 0.92 },
      ]);
    const ctx = { memorySearch: searchMock };
    const result = await executeTool(
      req('memory_search', { query: 'theme', topK: 3 }),
      baseState,
      ctx,
    );
    expect(searchMock).toHaveBeenCalledWith('theme', 3);
    const out = result.output as { results: any[]; count: number };
    expect(out.count).toBe(1);
    expect(out.results[0].score).toBe(0.92);
  });
});

// ─── ask_human ────────────────────────────────────────────────────────────────

describe('ask_human', () => {
  it('returns question and choices passthrough', async () => {
    const result = await executeTool(
      req('ask_human', { question: 'Approve?', choices: ['Yes', 'No'] }),
      baseState,
    );
    expect(result.output).toMatchObject({
      question: 'Approve?',
      choices: ['Yes', 'No'],
    });
  });
});

// ─── http_request ─────────────────────────────────────────────────────────────

describe('http_request', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls fetch with the right method and URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => '{"result":"ok"}',
    });
    global.fetch = mockFetch as any;

    await executeTool(
      req('http_request', { method: 'GET', url: 'https://example.com/api' }),
      baseState,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns { status, ok, data } on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => '{"hello":"world"}',
    }) as any;

    const result = await executeTool(
      req('http_request', { method: 'GET', url: 'https://example.com' }),
      baseState,
    );
    expect(result.output).toEqual({
      status: 200,
      ok: true,
      data: { hello: 'world' },
    });
  });

  it('returns raw text when body is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => 'not json',
    }) as any;

    const result = await executeTool(
      req('http_request', { method: 'GET', url: 'https://example.com' }),
      baseState,
    );
    expect((result.output as any).data).toBe('not json');
  });
});

// ─── unknown tool ─────────────────────────────────────────────────────────────

describe('unknown tool', () => {
  it('surfaces an error result', async () => {
    const result = await executeTool(req('nonexistent_tool'), baseState);
    expect(result.error).toContain('Unknown tool');
    expect(result.output).toBeNull();
  });
});
