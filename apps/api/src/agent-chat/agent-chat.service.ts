import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { secrets, pods, workflows } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { SecretsService } from '../secrets/secrets.service';
import type { ChatDto } from './dto/chat.dto';

const SYSTEM_PROMPT = `You are Linea's built-in AI assistant. Linea is a visual workflow automation platform (like n8n, Make.com, or Zapier) where automations are built by connecting nodes on a canvas.

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

Be direct, clear, and structured. Use emoji section headers for readability.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_workspace_secrets',
    description: 'Check which API keys and secrets are configured in this workspace. Returns secret names (not values).',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_pods',
    description: 'List all pods (projects/environments) in this workspace.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_workflows',
    description: 'List all workflows in a specific pod.',
    input_schema: {
      type: 'object',
      properties: { pod_id: { type: 'string', description: 'The pod ID to list workflows for' } },
      required: ['pod_id'],
    },
  },
  {
    name: 'create_workflow',
    description: 'Create a new workflow in a pod. Provide a complete node/edge definition.',
    input_schema: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID to create the workflow in' },
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Short description' },
        definition: {
          type: 'object',
          description: 'Workflow definition with nodes and edges arrays',
          properties: {
            nodes: { type: 'array' },
            edges: { type: 'array' },
          },
          required: ['nodes', 'edges'],
        },
      },
      required: ['pod_id', 'name', 'definition'],
    },
  },
];

@Injectable()
export class AgentChatService {
  private readonly anthropic: Anthropic;

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
    private readonly secretsService: SecretsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
    });
  }

  async *chat(workspaceId: string, dto: ChatDto): AsyncIterable<object> {
    const messages: Anthropic.MessageParam[] = dto.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let continueLoop = true;
    while (continueLoop) {
      const stream = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT + (dto.context?.podId ? `\n\nActive pod: ${dto.context.podId}${dto.context.podName ? ` (${dto.context.podName})` : ''}` : ''),
        tools: TOOLS,
        messages,
        stream: true,
      });

      let currentText = '';
      const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      let currentToolId = '';
      let currentToolName = '';
      let currentToolInput = '';
      let stopReason: string | null = null;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolId = event.content_block.id;
            currentToolName = event.content_block.name;
            currentToolInput = '';
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            currentText += event.delta.text;
            yield { type: 'text_delta', delta: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            currentToolInput += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolName) {
            let parsedInput: Record<string, unknown> = {};
            try { parsedInput = JSON.parse(currentToolInput) as Record<string, unknown>; } catch { /* ignore */ }
            toolUses.push({ id: currentToolId, name: currentToolName, input: parsedInput });
            yield { type: 'tool_call', id: currentToolId, name: currentToolName, input: parsedInput };
            currentToolName = '';
            currentToolInput = '';
          }
        } else if (event.type === 'message_delta') {
          stopReason = event.delta.stop_reason ?? null;
        }
      }

      // Build the assistant message for history
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (currentText) assistantContent.push({ type: 'text', text: currentText });
      for (const tu of toolUses) {
        assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
      }

      if (assistantContent.length > 0) {
        messages.push({ role: 'assistant', content: assistantContent });
      }

      if (stopReason === 'tool_use' && toolUses.length > 0) {
        // Execute tools and add results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const result = await this.executeTool(workspaceId, tu.name, tu.input, dto);
          yield { type: 'tool_result', id: tu.id, name: tu.name, result };
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
        }
        messages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    yield { type: 'done' };
  }

  private async executeTool(
    workspaceId: string,
    name: string,
    input: Record<string, unknown>,
    dto: ChatDto,
  ): Promise<unknown> {
    switch (name) {
      case 'check_workspace_secrets': {
        const rows = await this.secretsService.findAll(workspaceId);
        if (rows.length === 0) return { configured: [], message: 'No secrets configured yet.' };
        return { configured: rows.map((r) => r.name) };
      }

      case 'list_pods': {
        const rows = await this.db
          .select({ id: pods.id, name: pods.name, description: pods.description })
          .from(pods)
          .where(eq(pods.workspaceId, workspaceId));
        return { pods: rows };
      }

      case 'list_workflows': {
        const podId = input['pod_id'] as string;
        const rows = await this.db
          .select({ id: workflows.id, name: workflows.name, description: workflows.description, isPublic: workflows.isPublic })
          .from(workflows)
          .where(eq(workflows.podId, podId));
        return { workflows: rows };
      }

      case 'create_workflow': {
        const podId = input['pod_id'] as string;
        const name = input['name'] as string;
        const description = (input['description'] as string | undefined) ?? null;
        const definition = input['definition'] as { nodes: unknown[]; edges: unknown[] };

        const [created] = await this.db
          .insert(workflows)
          .values({
            podId,
            name,
            description,
            definition: definition as any,
          })
          .returning({ id: workflows.id, name: workflows.name });

        return { success: true, workflowId: created?.id, name: created?.name };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
