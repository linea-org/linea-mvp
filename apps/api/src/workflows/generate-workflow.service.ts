import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface GenerateEvent {
  type: 'progress' | 'node_added' | 'edge_added' | 'complete' | 'error';
  message?: string;
  node?: GeneratedNode;
  edge?: GeneratedEdge;
  name?: string;
  definition?: { nodes: GeneratedNode[]; edges: GeneratedEdge[] };
}

interface GeneratedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface GeneratedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

// Planner system prompt — broad context about every available node type
const PLANNER_SYSTEM = `\
You are the Planner sub-agent for Linea, an AI workflow automation platform.
Your job is to read a user's natural-language description and produce a MINIMAL, focused workflow plan.

Available node types:
  CORE     start, end
  AI       agent (LLM reasoning, tool use, structured output), memory (read/write key-value facts)
  LOGIC    if-else (boolean branch), router (multi-path based on output.branch)
  TOOLS    http (REST API calls), mcp (Model Context Protocol server tools)
  DATA     transform (JS expression), extract (web scraping), retriever (knowledge-base search)
  SAFETY   guardrails (PII/toxicity check), code (sandboxed JS)
  FLOW     loop (iterate array), subworkflow (call another workflow)
  INTEG    slack (requires SLACK_TOKEN), github (requires GITHUB_TOKEN),
           notion (requires NOTION_TOKEN), gmail (requires GMAIL_TOKEN)
  MISC     approval-gate (human-in-the-loop), note (canvas annotation only)

Variable substitution: any string field can reference previous outputs with {{nodeId}} or {{input.field}}.

Rules:
- Always begin with "start" and end with "end"
- 3–8 nodes is the sweet spot; avoid over-engineering
- Use "agent" for any LLM reasoning step
- Use "http" for external APIs without a built-in integration node
- Each step id must be unique, lowercase, snake_case

Return ONLY valid JSON — no prose, no markdown fences:
{
  "name": "Descriptive workflow name",
  "description": "One sentence description",
  "steps": [
    {
      "id": "unique_id",
      "type": "node_type",
      "label": "Human-readable label",
      "description": "What this step does",
      "depends_on": ["previous_step_id"]
    }
  ]
}`;

// Builder system prompt — turns the plan into a full workflow definition
const BUILDER_SYSTEM = `\
You are the Builder sub-agent for Linea. You receive a structured workflow plan and produce the
complete workflow definition JSON that the ReactFlow canvas can render.

NODE DATA FIELD REFERENCE (include only the relevant fields per node):

start      → { nodeType:"start", label }
end        → { nodeType:"end",   label }
agent      → { nodeType:"agent", label, model:"claude-sonnet-4-6", systemPrompt, userPrompt,
               tools?:["web_search"|"memory_store"|"memory_search"],
               outputSchema?:"<json schema string>", enableLongTermMemory?:false }
memory     → { nodeType:"memory", label, operation:"store"|"retrieve"|"search", key?, value?, query? }
http       → { nodeType:"http",  label, method:"GET"|"POST"|"PUT"|"PATCH"|"DELETE",
               url, headers?:{}, body? }
transform  → { nodeType:"transform", label, code:"JS expression, use 'input' variable, return value" }
if-else    → { nodeType:"if-else",   label, condition:"boolean JS expression" }
router     → { nodeType:"router",    label }
extract    → { nodeType:"extract",   label, url, fields:[{name,path}] }
retriever  → { nodeType:"retriever", label, query, topK:5 }
guardrails → { nodeType:"guardrails",label, checks:["pii"|"toxicity"], action:"block"|"redact"|"flag", input }
code       → { nodeType:"code",      label, code:"JS, assign result to 'output' variable" }
loop       → { nodeType:"loop",      label, items:"variableName", transform? }
subworkflow→ { nodeType:"subworkflow",label, workflowId:"<uuid>" }
slack      → { nodeType:"slack",     label, action:"send_message"|"send_dm"|"list_channels",
               channel?, userId?, message? }
github     → { nodeType:"github",    label, action:"create_issue"|"comment_issue"|"list_issues"|"create_pr",
               owner, repo, title?, body?, issueNumber?, head?, base? }
notion     → { nodeType:"notion",    label, action:"create_page"|"append_block"|"query_database"|"get_page",
               databaseId?, pageId?, properties?:{}, blocks?:[], filter?:{} }
gmail      → { nodeType:"gmail",     label, action:"send_email"|"list_emails"|"get_email",
               to?, subject?, body?, messageId?, maxResults? }
approval-gate → { nodeType:"approval-gate", label, message }

EDGE FORMAT:
  Normal edge:   { "id":"e1","source":"a","target":"b" }
  If-else true:  { "id":"e2","source":"cond","target":"yes","sourceHandle":"true" }
  If-else false: { "id":"e3","source":"cond","target":"no", "sourceHandle":"false" }
  Router branch: { "id":"e4","source":"route","target":"x", "sourceHandle":"branchName" }

LAYOUT RULES (x,y positions):
  - Main flow: x = 120 + (stepIndex * 260), y = 300
  - If-else true branch:  y = 120  (above)
  - If-else false branch: y = 480  (below)
  - Router branches: space them vertically by 180px

Return ONLY valid JSON — no prose, no markdown fences:
{
  "nodes": [ { "id":"...", "type":"...", "position":{"x":...,"y":...}, "data":{...} } ],
  "edges": [ { "id":"...", "source":"...", "target":"..." } ]
}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class GenerateWorkflowService {
  private readonly logger = new Logger(GenerateWorkflowService.name);

  async *generate(
    rawPrompt: string,
    signal?: AbortSignal,
    canvasContext?: {
      nodeCount: number;
      nodeTypes: string[];
      nodeLabels: string[];
    },
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): AsyncGenerator<GenerateEvent> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      yield {
        type: 'error',
        message: 'ANTHROPIC_API_KEY is not configured on this server.',
      };
      return;
    }

    if (signal?.aborted) return;

    const MAX_PROMPT_LENGTH = 2000;
    const prompt = rawPrompt.slice(0, MAX_PROMPT_LENGTH);

    // Build canvas context string for the planner
    let canvasCtxStr = '';
    if (canvasContext && canvasContext.nodeCount > 0) {
      canvasCtxStr = `\n<current_canvas>\nThe canvas currently has ${canvasContext.nodeCount} node(s): ${canvasContext.nodeTypes.join(', ')}.\nNode labels: ${canvasContext.nodeLabels.join(', ')}.\nYou may extend, modify, or replace the existing workflow based on the user request.\n</current_canvas>`;
    }

    const safeUserContent = `<user_request>\n${prompt}\n</user_request>${canvasCtxStr}\n\nBased on the user request above, produce the workflow plan JSON.`;

    // Build message history for planner (last 3 turns for context, excluding latest)
    const plannerHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [];
    if (history && history.length > 0) {
      const recent = history.slice(-6); // last 3 turns (user+assistant pairs)
      for (const msg of recent) {
        plannerHistory.push({
          role: msg.role,
          content: msg.content.slice(0, 500),
        });
      }
    }

    const client = new Anthropic({ apiKey });

    yield {
      type: 'progress',
      message: 'Planner is designing the workflow structure…',
    };

    let plan: {
      name: string;
      description: string;
      steps: Array<{
        id: string;
        type: string;
        label: string;
        description: string;
        depends_on: string[];
      }>;
    };

    try {
      const plannerResponse = await client.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: PLANNER_SYSTEM,
          messages: [
            ...plannerHistory,
            { role: 'user', content: safeUserContent },
          ],
        },
        { signal },
      );

      const planText =
        plannerResponse.content.find((c) => c.type === 'text')?.text ?? '{}';
      plan = JSON.parse(planText.trim());
    } catch (err) {
      yield {
        type: 'error',
        message: `Planner failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      return;
    }

    if (signal?.aborted) return;
    this.logger.log(
      `Planner produced plan with ${plan.steps?.length ?? 0} steps`,
    );
    yield {
      type: 'progress',
      message: `Plan ready: ${plan.steps?.length ?? 0} nodes — building the workflow…`,
    };

    let definition: { nodes: GeneratedNode[]; edges: GeneratedEdge[] };

    try {
      const builderPrompt = `<user_request>\n${prompt}\n</user_request>${canvasCtxStr}\n\nPlan:\n${JSON.stringify(plan, null, 2)}\n\nBuild the full workflow definition JSON for the plan above.`;

      const builderResponse = await client.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: BUILDER_SYSTEM,
          messages: [{ role: 'user', content: builderPrompt }],
        },
        { signal },
      );

      const defText =
        builderResponse.content.find((c) => c.type === 'text')?.text ?? '{}';
      definition = JSON.parse(defText.trim());
    } catch (err) {
      yield {
        type: 'error',
        message: `Builder failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      return;
    }

    if (!Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
      yield {
        type: 'error',
        message: 'Builder returned an invalid workflow structure.',
      };
      return;
    }

    // Ensure every node has a proper "type" field matching its nodeType data
    for (const node of definition.nodes) {
      const nodeType = (node.data?.nodeType as string | undefined) ?? node.type;
      node.type = nodeType;
      if (!node.data) node.data = {};
      node.data.nodeType = nodeType;
    }

    yield {
      type: 'progress',
      message: `Adding ${definition.nodes.length} nodes to canvas…`,
    };

    for (const node of definition.nodes) {
      yield { type: 'node_added', node };
      await sleep(220);
    }

    for (const edge of definition.edges) {
      yield { type: 'edge_added', edge };
      await sleep(120);
    }

    yield {
      type: 'complete',
      name: plan.name ?? 'Generated Workflow',
      definition,
    };
  }
}
