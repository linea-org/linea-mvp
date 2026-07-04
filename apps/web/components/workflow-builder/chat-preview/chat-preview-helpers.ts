export function extractReply(output: unknown): string {
  if (output === null || output === undefined) return '(no output)';
  if (typeof output === 'string') return output;
  const o = output as Record<string, unknown>;
  if (typeof o['message'] === 'string') return o['message'];
  if (typeof o['result'] === 'string') return o['result'];
  if (typeof o['response'] === 'string') return o['response'];
  if (typeof o['text'] === 'string') return o['text'];
  return JSON.stringify(output, null, 2);
}

export function isErrorOutput(output: unknown): output is { error: string } {
  if (output === null || typeof output !== 'object') return false;
  const o = output as Record<string, unknown>;
  const hasPriorityField = 'message' in o || 'result' in o || 'response' in o || 'text' in o;
  return typeof o['error'] === 'string' && !hasPriorityField;
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
