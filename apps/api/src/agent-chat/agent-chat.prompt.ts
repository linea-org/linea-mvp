import type { ToolDefinition } from '../executions/engine/tools/definitions';

export const SYSTEM_PROMPT = `You are Linea's built-in AI assistant. Linea is a visual workflow automation platform (like n8n, Make.com, or Zapier) where automations are built by connecting nodes on a canvas.

## Node Types (all have: id, type, position {x,y}, data {nodeType, nodeName, ...fields})

- **start** — Entry point. data: {inputVariables: [{name, type, required?, description?, defaultValue?}]}
- **end** — Terminal node. data: {}
- **agent** — AI LLM agent. data: {model: string, systemPrompt: string, userPrompt: string, temperature?: number}
  Available models: claude-sonnet-4-6, claude-opus-4-7, gpt-4o, gpt-4o-mini, gemini-2.0-flash, llama3.2, mistral, qwen2.5
- **http** — HTTP request. data: {method: "GET"|"POST"|"PUT"|"DELETE"|"PATCH", url: string, headers?: object, body?: string}
- **code** — JavaScript executor. data: {code: string} (must export async default function(input){return result;})
- **transform** — Template. data: {template: string} (use {{input.fieldName}} for substitution)
- **if-else** — Boolean branch. data: {condition: string (JS expression, refs input.*)}; handles: "true", "false"
- **router** — N-way branch. data: {routes: [{id: string, label: string, condition: string}]}; handles: each route.id
- **loop** — Iterate. data: {inputPath: string (dot-path to array), outputKey: string}
- **parallel** — Concurrent branches. data: {branches?: number}
- **slack** — Send message. data: {channel: string, message: string} [requires SLACK_BOT_TOKEN]
- **gmail** — Send email. data: {to: string, subject: string, body: string} [requires Gmail OAuth]
- **github** — GitHub ops. data: {action: "create_issue"|"create_pr"|"list_prs", repo: string, title?: string, body?: string} [requires GITHUB_TOKEN]
- **notion** — Notion ops. data: {action: "create_page"|"list_pages", databaseId?: string, title?: string, properties?: object} [requires NOTION_TOKEN]
- **memory** — Key-value store. data: {action: "store"|"retrieve", key: string, value?: string}
- **retriever** — Vector search. data: {query: string, topK?: number}
- **mcp** — MCP tool. data: {serverId: string, tool: string, parameters?: object}
- **wait** — Pause. data: {duration: number, unit: "seconds"|"minutes"|"hours"}
- **approval** — Human-in-loop. data: {message: string, prompt?: string}
- **extract** — AI extraction. data: {schema: object, prompt: string, model?: string}
- **evaluator** — Score output. data: {criteria: string, model?: string}
- **subworkflow** — Call other workflow. data: {workflowId: string, input?: object}

## Edge Format
{id: string, source: nodeId, target: nodeId, sourceHandle?: string}
- if-else: sourceHandle = "true" or "false"
- router: sourceHandle = route.id
- others: no sourceHandle

## Required Secrets (set in Settings → Secrets)
- ANTHROPIC_API_KEY — Claude models
- OPENAI_API_KEY — GPT models
- GROQ_API_KEY — Groq models
- GOOGLE_API_KEY — Gemini models
- SLACK_BOT_TOKEN — Slack
- GITHUB_TOKEN — GitHub
- NOTION_TOKEN — Notion

## How to Help
1. Use check_workspace_secrets to know what's available
2. Use list_pods to find where to create workflows
3. Plan the automation clearly, node by node
4. Use create_workflow to build it (set realistic node positions)
5. If missing secrets: list exactly which ones to add and where (Settings → Secrets)
6. Use run_workflow to test an existing workflow — pass input: { message: "..." } for chat-style workflows
7. Use save_to_memory to remember user preferences, names, or facts across conversations
8. Use list_executions / get_execution to inspect recent runs and debug failures
9. Use list_schedules to show what's scheduled in a pod
10. Use list_mcp_servers / call_mcp_tool to interact with any MCP server configured in the workspace

Be direct, clear, and structured. Use emoji section headers for readability.`;

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'check_workspace_secrets',
    description:
      'Check which API keys and secrets are configured in this workspace. Returns secret names (not values).',
    parameters: { type: 'object', properties: {}, required: [] },
    approval: 'never',
  },
  {
    name: 'list_pods',
    description: 'List all pods (projects/environments) in this workspace.',
    parameters: { type: 'object', properties: {}, required: [] },
    approval: 'never',
  },
  {
    name: 'list_workflows',
    description: 'List all workflows in a specific pod.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'The pod ID to list workflows for',
        },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'create_workflow',
    description:
      'Create a new workflow in a pod. Provide a complete node/edge definition.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID to create the workflow in',
        },
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Short description' },
        definition: {
          type: 'object',
          description: 'Workflow definition with nodes and edges arrays',
          properties: { nodes: { type: 'array' }, edges: { type: 'array' } },
          required: ['nodes', 'edges'],
        },
      },
      required: ['pod_id', 'name', 'definition'],
    },
    approval: 'never',
  },
  {
    name: 'run_workflow',
    description:
      'Trigger a workflow execution and wait for its result (up to 60 seconds). For chatbot workflows pass input: { message: "..." }. Returns output on success, or an error.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID that owns the workflow',
        },
        workflow_id: { type: 'string', description: 'Workflow ID to execute' },
        input: {
          type: 'object',
          description: 'Input variables',
          properties: {},
          required: [],
        },
      },
      required: ['pod_id', 'workflow_id'],
    },
    approval: 'never',
  },
  {
    name: 'save_to_memory',
    description:
      'Persist a piece of information so you can recall it in future conversations with this user. Use for names, preferences, context, or any fact worth remembering long-term.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'Short descriptive key, e.g. "user_name" or "preferred_language"',
        },
        value: { type: 'string', description: 'The information to remember' },
      },
      required: ['key', 'value'],
    },
    approval: 'never',
  },
  {
    name: 'list_executions',
    description:
      'List recent executions for a pod, optionally filtered by workflow. Returns id, status, triggeredBy, startedAt, finishedAt.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID to list executions for',
        },
        workflow_id: {
          type: 'string',
          description: 'Optional: filter by workflow ID',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10, max 50)',
        },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'get_execution',
    description:
      'Get details of a specific execution — status, output, error, node results.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID that owns the execution',
        },
        execution_id: { type: 'string', description: 'Execution ID' },
      },
      required: ['pod_id', 'execution_id'],
    },
    approval: 'never',
  },
  {
    name: 'list_schedules',
    description:
      'List scheduled triggers for a pod — cron expression, enabled state, last and next run times.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID to list schedules for' },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'list_mcp_servers',
    description:
      'List all MCP (Model Context Protocol) servers configured in this workspace. Returns id, name, and url for each server.',
    parameters: { type: 'object', properties: {}, required: [] },
    approval: 'never',
  },
  {
    name: 'call_mcp_tool',
    description:
      'Call a tool on a configured MCP server. First use list_mcp_servers to find available servers, then call a specific tool with parameters.',
    parameters: {
      type: 'object',
      properties: {
        server_id: {
          type: 'string',
          description: 'MCP server ID (from list_mcp_servers)',
        },
        tool_name: {
          type: 'string',
          description: 'Name of the tool to call on the MCP server',
        },
        parameters: {
          type: 'object',
          description: 'Tool parameters as key-value pairs',
        },
      },
      required: ['server_id', 'tool_name'],
    },
    approval: 'never',
  },
];
