import { WorkflowState } from '../../../executions/engine/variable-substitution.js';
import { assertSafeUrl } from '../../../common/utils/ssrf-guard.js';

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolCallResult {
  toolCallId: string;
  name: string;
  output: unknown;
  error?: string;
}

/** Optional context injected from NodeExecutorService for DB-backed operations. */
export interface ToolExecutorContext {
  /** Persist a memory entry to the long-term store with embedding. */
  memoryStore?: (key: string, value: string) => Promise<void>;
  /** Semantic search across long-term memories. */
  memorySearch?: (
    query: string,
    topK: number,
  ) => Promise<Array<{ key: string; value: unknown; score: number }>>;
}

const HTTP_TIMEOUT_MS = 30_000;

export async function executeTool(
  call: ToolCallRequest,
  state: WorkflowState,
  ctx?: ToolExecutorContext,
): Promise<ToolCallResult> {
  try {
    const output = await dispatch(call, state, ctx);
    return { toolCallId: call.id, name: call.name, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { toolCallId: call.id, name: call.name, output: null, error };
  }
}

async function dispatch(
  call: ToolCallRequest,
  state: WorkflowState,
  ctx?: ToolExecutorContext,
): Promise<unknown> {
  const args = call.arguments;

  switch (call.name) {
    case 'http_request':
      return httpRequest(args);

    case 'run_javascript':
      throw new Error(
        'run_javascript is disabled. Arbitrary code execution requires a dedicated Pod VM. ' +
          'Use the transform node for data reshaping or the agent node for logic.',
      );

    case 'read_variable':
      return state.variables[args.name as string] ?? null;

    case 'write_variable': {
      let val: unknown = args.value;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch {
          /* keep as string */
        }
      }
      // Mutation reflected back via __variableUpdates in agent result
      return { __writeVariable: { name: args.name, value: val } };
    }

    case 'ask_human':
      // This tool is handled by the approval gate — never actually executed here
      return { question: args.question, choices: args.choices };

    case 'memory_store': {
      const key = args.key as string;
      const value = args.value as string;
      // Persist to long-term DB store if context is available
      if (ctx?.memoryStore) {
        await ctx.memoryStore(key, value);
      }
      return { __memoryWrite: { key, value } };
    }

    case 'memory_search': {
      const query = String(args.query ?? '');
      const topK = Number(args.topK ?? 5);

      // Semantic search via DB if context is available
      if (ctx?.memorySearch) {
        const results = await ctx.memorySearch(query, topK);
        return { results, count: results.length };
      }

      // Fallback: text substring match on in-memory state
      const q = query.toLowerCase();
      const results: Array<{ key: string; value: unknown; score: number }> = [];
      for (const [k, v] of Object.entries(state.memory ?? {})) {
        const valueStr = typeof v === 'string' ? v : JSON.stringify(v);
        if (k.toLowerCase().includes(q) || valueStr.toLowerCase().includes(q)) {
          results.push({ key: k, value: v, score: 0.5 });
        }
      }
      return { results, count: results.length };
    }

    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB

async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
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

async function httpRequest(args: Record<string, any>): Promise<unknown> {
  const { method, url, headers = {}, body } = args;

  await assertSafeUrl(url as string);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url as string, {
      method: method as string,
      headers: {
        'Content-Type': 'application/json',
        ...(headers as Record<string, string>),
      },
      ...(body ? { body: body as string } : {}),
      signal: controller.signal,
    });

    const raw = await readBodyWithLimit(res);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}
