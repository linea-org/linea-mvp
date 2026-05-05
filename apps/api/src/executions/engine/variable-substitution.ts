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
  let current: any = { state };

  for (const part of parts) {
    if (current == null) return undefined;
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current[part];
    }
  }

  if (
    current === undefined &&
    normalizedExpr.startsWith('state.variables.input.')
  ) {
    const inputPath = normalizedExpr.replace('state.variables.input.', '');
    return state.variables?.input?.[inputPath] ?? state.variables?.[inputPath];
  }

  return current;
}
