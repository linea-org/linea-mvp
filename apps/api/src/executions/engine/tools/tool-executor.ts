import { createContext, Script } from 'vm';
import type { WorkflowState } from '../variable-substitution';

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

const JS_TIMEOUT_MS = 5_000;
const HTTP_TIMEOUT_MS = 30_000;

export async function executeTool(
  call: ToolCallRequest,
  state: WorkflowState,
): Promise<ToolCallResult> {
  try {
    const output = await dispatch(call, state);
    return { toolCallId: call.id, name: call.name, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { toolCallId: call.id, name: call.name, output: null, error };
  }
}

async function dispatch(
  call: ToolCallRequest,
  state: WorkflowState,
): Promise<unknown> {
  const args = call.arguments;

  switch (call.name) {
    case 'http_request':
      return httpRequest(args);

    case 'run_javascript':
      return runJavaScript(args.code as string, args.input);

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

    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}

async function httpRequest(args: Record<string, any>): Promise<unknown> {
  const { method, url, headers = {}, body } = args;

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

    const raw = await res.text();
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

function runJavaScript(code: string, inputStr?: string): unknown {
  let input: unknown;
  if (inputStr) {
    try {
      input = JSON.parse(inputStr);
    } catch {
      input = inputStr;
    }
  }

  const sandbox = {
    input,
    result: undefined as unknown,
    console: {
      log: (...args: unknown[]) => {}, // silenced in sandbox
    },
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };

  const ctx = createContext(sandbox);
  // Wrap in IIFE so `return` works at top level
  const wrapped = `(function() { ${code} })()`;
  const script = new Script(wrapped);
  const output = script.runInContext(ctx, { timeout: JS_TIMEOUT_MS });
  return output;
}
