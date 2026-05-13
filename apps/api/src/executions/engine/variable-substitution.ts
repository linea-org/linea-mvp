export interface WorkflowState {
  variables: Record<string, any>;
  chatHistory: Array<{ role: string; content: string }>;
  memory?: Record<string, any>;
  nodeResults?: Record<string, any>;
  pendingAuth?: any;
  loopResults?: any[];
  cumulativeUsage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

// Keys that can be reached from {{...}} expressions — never expose secrets or internal state
const ALLOWED_STATE_ROOTS = new Set(['variables', 'nodeResults', 'loopResults']);

// Block prototype-chain property names regardless of depth
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function substituteInValue(value: unknown, state: WorkflowState): unknown {
  if (typeof value === 'string') return substituteVariables(value, state);
  if (Array.isArray(value)) return value.map((v) => substituteInValue(v, state));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteInValue(v, state);
    }
    return result;
  }
  return value;
}

export function substituteVariables(
  text: string,
  state: WorkflowState,
): string {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
    try {
      const value = evaluateExpression(expression.trim(), state);
      if (value === null || value === undefined) return match;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    } catch {
      return match;
    }
  });
}

function evaluateExpression(expression: string, state: WorkflowState): any {
  let normalizedExpr = expression;
  if (!expression.startsWith('state.')) {
    normalizedExpr = `state.variables.${expression}`;
  }

  const parts = normalizedExpr.split('.');

  // parts[0] must be 'state', parts[1] must be an allowed root
  if (parts[0] !== 'state') return undefined;
  if (parts.length > 1 && !ALLOWED_STATE_ROOTS.has(parts[1]!)) return undefined;

  // Walk the path — block prototype-pollution keys at every level
  let current: any = { state };
  for (const part of parts) {
    if (current == null) return undefined;
    if (FORBIDDEN_KEYS.has(part)) return undefined;

    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const idx = parseInt(arrayMatch[2]!);
      if (FORBIDDEN_KEYS.has(key)) return undefined;
      current = current[key]?.[idx];
    } else {
      current = current[part];
    }
  }

  if (
    current === undefined &&
    normalizedExpr.startsWith('state.variables.input.')
  ) {
    const inputPath = normalizedExpr.replace('state.variables.input.', '');
    if (FORBIDDEN_KEYS.has(inputPath)) return undefined;
    return state.variables?.input?.[inputPath] ?? state.variables?.[inputPath];
  }

  return current;
}
