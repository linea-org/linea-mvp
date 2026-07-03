// ─────────────────────────────────────────────────────────────────────────────
// Built-in tool definitions — what agents can call
//
// Add new tools here. Each tool has:
//   name        - identifier the LLM uses
//   description - what the LLM sees (be precise — affects when it chooses the tool)
//   parameters  - JSON Schema for the tool arguments
//   approval    - when human confirmation is required
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolParameterSchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required: string[];
  };
  /** When does this tool need human approval before executing? */
  approval: 'never' | 'always' | 'on_mutation';
}

export const BUILTIN_TOOLS: Record<string, ToolDefinition> = {
  memory_store: {
    name: 'memory_store',
    description:
      'Store a key-value fact in long-term memory. The fact persists across executions of this workflow and can be retrieved semantically with memory_search. Use this to remember important facts, preferences, or outcomes for future runs.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'Short descriptive name for this memory (e.g. "user_preference", "last_result")',
        },
        value: {
          type: 'string',
          description: 'Value to store (plain text or JSON string)',
        },
      },
      required: ['key', 'value'],
    },
    approval: 'never',
  },

  memory_search: {
    name: 'memory_search',
    description:
      'Search long-term memory for facts relevant to the query. Uses semantic similarity — results come from previous executions of this workflow. Returns the most relevant stored facts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What you want to recall — described in natural language',
        },
        topK: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
    approval: 'never',
  },

  http_request: {
    name: 'http_request',
    description:
      'Make an HTTP request to any URL. Use for calling APIs, fetching web pages, sending data to external services.',
    parameters: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method',
        },
        url: { type: 'string', description: 'Full URL including query string' },
        headers: {
          type: 'object',
          description: 'Request headers as key-value pairs',
          properties: {},
        },
        body: {
          type: 'string',
          description: 'Request body as a JSON string (for POST/PUT/PATCH)',
        },
      },
      required: ['method', 'url'],
    },
    approval: 'on_mutation', // GET is auto-approved; POST/PUT/PATCH/DELETE need approval
  },

  run_javascript: {
    name: 'run_javascript',
    description:
      'Execute a JavaScript code snippet. Has access to `input` (the last tool result or workflow variable). Returns the value of the last expression. Use for data transformation, calculations, and string manipulation.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'JavaScript code to execute. Last expression is the return value.',
        },
        input: {
          type: 'string',
          description:
            'Optional JSON string passed as `input` variable inside the code',
        },
      },
      required: ['code'],
    },
    approval: 'always', // Code execution is always a human decision
  },

  ask_human: {
    name: 'ask_human',
    description:
      'Pause execution and ask the human a question. Use when you need clarification, additional input, or a decision that only the user can make.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the human',
        },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of suggested answers (e.g. ["yes", "no"])',
        },
      },
      required: ['question'],
    },
    approval: 'always',
  },

  read_variable: {
    name: 'read_variable',
    description: 'Read a variable from the current workflow state.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Variable name' },
      },
      required: ['name'],
    },
    approval: 'never',
  },

  write_variable: {
    name: 'write_variable',
    description:
      'Write a value to a named variable in the workflow state. Other nodes can read it.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Variable name' },
        value: {
          type: 'string',
          description: 'Value to store (JSON string or plain text)',
        },
      },
      required: ['name', 'value'],
    },
    approval: 'never',
  },
};

export function getEnabledTools(
  toolNames: string[],
  overrideApprovals: Record<string, 'never' | 'always' | 'on_mutation'> = {},
): ToolDefinition[] {
  return toolNames
    .filter((name) => BUILTIN_TOOLS[name])
    .map((name) => ({
      ...BUILTIN_TOOLS[name],
      // Per-node approval overrides
      ...(overrideApprovals[name] ? { approval: overrideApprovals[name] } : {}),
    }));
}

export function toolNeedsApproval(
  tool: ToolDefinition,
  args: Record<string, any>,
): boolean {
  if (tool.approval === 'always') return true;
  if (tool.approval === 'never') return false;
  if (tool.approval === 'on_mutation') {
    const method = (args['method'] as string)?.toUpperCase();
    return method !== 'GET' && method !== 'HEAD';
  }
  return false;
}
