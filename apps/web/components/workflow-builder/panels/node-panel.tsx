'use client';

import { useState, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon, Delete01Icon,
  Settings01Icon, FlowConnectionIcon, NoteAddIcon,
  AiBrain01Icon, RepeatIcon, Loading01Icon,
} from '@hugeicons/core-free-icons';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;
import type { Node, Edge } from '@xyflow/react';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { Separator } from '@linea/ui/components/separator';
import type { NodeResult } from '../index';
import { AgentPanel } from './agent-panel';
import { HttpPanel } from './http-panel';
import { TransformPanel } from './transform-panel';
import { LogicPanel } from './logic-panel';
import { RouterPanel } from './router-panel';
import { StartPanel } from './start-panel';
import { ApprovalPanel } from './approval-panel';
import { McpPanel } from './mcp-panel';
import { MemoryPanel } from './memory-panel';
import { ExtractPanel } from './extract-panel';
import { RetrieverPanel } from './retriever-panel';
import { GuardrailsPanel } from './guardrails-panel';
import { CodePanel } from './code-panel';
import { LoopPanel } from './loop-panel';
import { SubworkflowPanel } from './subworkflow-panel';
import { SlackPanel } from './slack-panel';
import { GitHubPanel } from './github-panel';
import { NotionPanel } from './notion-panel';
import { GmailPanel } from './gmail-panel';
import { ParallelPanel } from './parallel-panel';
import { WaitPanel } from './wait-panel';
import { VariablesPanel } from './variables-panel';
import { EvaluatorPanel } from './evaluator-panel';
import { FilterPanel } from './filter-panel';
import { MergePanel } from './merge-panel';
import { DatetimePanel } from './datetime-panel';
import { cn } from '@linea/ui/lib/utils';

interface NodePanelProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  nodes: Node[];
  edges: Edge[];
  nodeResult?: NodeResult;
  token?: string;
  workspaceId?: string;
  podId?: string;
  executionId?: string;
  onRetry?: () => void;
}

type PanelTab = 'editor' | 'connections' | 'document';

const nodeTypeLabels: Record<string, string> = {
  start:       'Start',       end:        'End',
  agent:       'Agent',       http:       'HTTP Request',
  transform:   'Transform',   'if-else':  'If-Else',
  router:      'Router',      approval:   'Approval',
  mcp:         'MCP Tool',    memory:     'Memory',
  extract:     'Extract',     retriever:  'Retriever',
  guardrails:  'Guardrails',  code:       'Code',
  loop:        'Loop',        parallel:   'Parallel',
  wait:        'Wait',        variables:  'Variables',
  evaluator:   'Evaluator',   subworkflow:'Sub-workflow',
  slack:       'Slack',       github:     'GitHub',
  notion:      'Notion',      gmail:      'Gmail',
  filter:      'Filter',      merge:      'Merge',
  datetime:    'Date/Time',
  note:        'Note',
  frame:       'Frame',
};

const nodeTypeColors: Record<string, string> = {
  start:       '#6366f1', end:        '#14b8a6',
  agent:       '#3b82f6', http:       '#8b5cf6',
  transform:   '#7c3aed', 'if-else':  '#f59e0b',
  router:      '#ea580c', approval:   '#9ca3af',
  mcp:         '#eab308', memory:     '#a855f7',
  extract:     '#0ea5e9', retriever:  '#10b981',
  guardrails:  '#ef4444', code:       '#64748b',
  loop:        '#0891b2', parallel:   '#6366f1',
  wait:        '#64748b', variables:  '#059669',
  evaluator:   '#d97706', subworkflow:'#7c3aed',
  slack:       '#4a154b', github:     '#1f2328',
  notion:      '#37352f', gmail:      '#ea4335',
  filter:      '#06b6d4', merge:      '#8b5cf6',
  datetime:    '#0d9488',
  note:        '#ca8a04', frame:      '#6366f1',
};

/* ─── Connections tab ────────────────────────────────────────────── */
function ConnectionsTab({ node, nodes, edges }: { node: Node; nodes: Node[]; edges: Edge[] }) {
  const incoming = edges.filter((e) => e.target === node.id);
  const outgoing = edges.filter((e) => e.source === node.id);

  function nodeName(id: string) {
    const n = nodes.find((x) => x.id === id);
    return (n?.data?.nodeName as string) ?? (n?.data?.label as string) ?? n?.type ?? id;
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <HugeiconsIcon icon={FlowConnectionIcon} className="size-8 text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground">No connections yet.</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">Draw edges to connect this node.</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {incoming.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Inputs</p>
          <div className="space-y-1">
            {incoming.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                <span className="flex-1 truncate text-foreground font-medium">{nodeName(e.source)}</span>
                {e.sourceHandle && (
                  <span className="text-[10px] text-muted-foreground rounded-full border border-border px-1.5 py-0.5 font-mono shrink-0">
                    {e.sourceHandle}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Outputs</p>
          <div className="space-y-1">
            {outgoing.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
                <span className="flex-1 truncate text-foreground font-medium">{nodeName(e.target)}</span>
                {e.sourceHandle && (
                  <span className="text-[10px] text-muted-foreground rounded-full border border-border px-1.5 py-0.5 font-mono shrink-0">
                    {e.sourceHandle}
                  </span>
                )}
                <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Node reference docs ────────────────────────────────────────── */
interface NodeDoc {
  summary: string;
  fields?: Array<{ name: string; desc: string }>;
  inputs?: string[];
  outputs?: string[];
  tips?: string[];
}

const NODE_DOCS: Record<string, NodeDoc> = {
  start: {
    summary: 'Entry point of the workflow. Every execution begins here. Supports manual, scheduled, webhook, and event triggers.',
    fields: [
      { name: 'Trigger type', desc: 'How the workflow is initiated: Manual, Schedule (cron), Webhook (HTTP POST), or Event.' },
      { name: 'Cron expression', desc: 'Standard cron syntax for scheduled runs (e.g. 0 9 * * 1 = every Monday at 9 AM).' },
      { name: 'Webhook secret', desc: 'Optional HMAC secret to verify incoming webhook payloads.' },
    ],
    outputs: ['trigger — carries the input payload into the workflow'],
    tips: [
      'Use webhook triggers to integrate with external systems like GitHub or Stripe.',
      'Schedule triggers fire in UTC by default.',
    ],
  },
  end: {
    summary: 'Marks successful workflow termination. Any data passed into the End node becomes the workflow\'s final output.',
    inputs: ['result — the final output value of the workflow'],
    tips: ['You can have multiple End nodes to support branching exits.'],
  },
  agent: {
    summary: 'Runs an LLM agent with a system prompt, tool access, and optional memory. The agent reasons iteratively until it produces a final answer.',
    fields: [
      { name: 'Model', desc: 'Which LLM to use (e.g. Claude Sonnet, GPT-4o, Gemini Pro).' },
      { name: 'System prompt', desc: 'Persistent instructions that shape agent behavior and persona.' },
      { name: 'User message', desc: 'The task or question sent to the agent each run. Supports {{variable}} interpolation.' },
      { name: 'Max iterations', desc: 'Safety cap on the reasoning loop to prevent runaway costs.' },
      { name: 'Tools', desc: 'List of tools the agent can invoke (e.g. search, HTTP, MCP).' },
      { name: 'Memory', desc: 'Enable to persist context across executions.' },
    ],
    inputs: ['context — data passed from upstream nodes, available as variables'],
    outputs: ['output — the agent\'s final text or structured response'],
    tips: [
      'Reference upstream outputs with {{nodeName.output}} in the user message.',
      'Keep system prompts focused — verbose prompts increase latency.',
      'Enable memory only when continuity across runs is needed.',
    ],
  },
  http: {
    summary: 'Makes an outbound HTTP request to any REST API. Handles auth, headers, query params, and JSON/form bodies.',
    fields: [
      { name: 'Method', desc: 'GET, POST, PUT, PATCH, DELETE.' },
      { name: 'URL', desc: 'Target endpoint. Supports {{variable}} interpolation.' },
      { name: 'Headers', desc: 'Key-value pairs sent with every request.' },
      { name: 'Auth', desc: 'Bearer token, Basic, or API key authentication.' },
      { name: 'Body', desc: 'JSON or form-encoded payload for POST/PUT/PATCH.' },
      { name: 'Timeout', desc: 'Max wait time in milliseconds before failing.' },
    ],
    inputs: ['data — used to build URL or body via variable substitution'],
    outputs: ['response — parsed JSON body, status code, and response headers'],
    tips: [
      'Store API keys in workflow secrets and reference them with {{secrets.KEY}}.',
      'Set a timeout to avoid hanging executions on slow APIs.',
    ],
  },
  transform: {
    summary: 'Reshapes data using JSONata expressions or simple field mappings. Use it to extract, rename, or restructure fields between nodes.',
    fields: [
      { name: 'Expression', desc: 'JSONata query or JS-like expression applied to input data.' },
      { name: 'Output key', desc: 'The key under which the result is stored in the workflow context.' },
    ],
    inputs: ['data — any object or array from an upstream node'],
    outputs: ['result — transformed data written to the specified output key'],
    tips: [
      'JSONata supports filtering, aggregation, and string manipulation.',
      'Use Transform to normalize API responses before passing to an agent.',
    ],
  },
  'if-else': {
    summary: 'Branches workflow execution based on a boolean condition. Routes to True or False paths independently.',
    fields: [
      { name: 'Condition', desc: 'A JavaScript expression that evaluates to true or false (e.g. data.status === "active").' },
    ],
    inputs: ['data — the context object evaluated by the condition'],
    outputs: ['true — taken when condition is truthy', 'false — taken when condition is falsy'],
    tips: [
      'Both branches can rejoin at a later node.',
      'Nest If-Else nodes for multi-condition logic, or use a Router for more than two branches.',
    ],
  },
  router: {
    summary: 'Routes to one of N named output branches based on matching a value against defined cases. Equivalent to a switch/match statement.',
    fields: [
      { name: 'Value expression', desc: 'Expression whose result is matched against branch labels.' },
      { name: 'Branches', desc: 'Named output handles, each with a matching value or "default".' },
    ],
    inputs: ['data — context object from which the value is extracted'],
    outputs: ['[branch name] — one output per defined route; only the matched branch fires'],
    tips: [
      'Add a "default" branch to catch unmatched values.',
      'Branch names become the handle labels visible on the node.',
    ],
  },
  approval: {
    summary: 'Pauses the workflow and sends an approval request (email, Slack, etc.). Execution resumes only after a human approves or rejects.',
    fields: [
      { name: 'Approvers', desc: 'Comma-separated email addresses or user IDs.' },
      { name: 'Message', desc: 'Explanation shown to the approver.' },
      { name: 'Timeout', desc: 'Duration before auto-rejecting if no response is received.' },
      { name: 'Channel', desc: 'How to notify approvers: Email, Slack, or in-app.' },
    ],
    inputs: ['data — payload shown in the approval request'],
    outputs: ['approved — path taken on approval', 'rejected — path taken on rejection'],
    tips: [
      'Use Approval nodes before irreversible actions like sending emails or deploying.',
      'Set a timeout so workflows don\'t hang indefinitely.',
    ],
  },
  mcp: {
    summary: 'Calls a tool exposed via the Model Context Protocol (MCP). Connects to MCP servers to access external tools and data sources.',
    fields: [
      { name: 'Server', desc: 'MCP server URL or configured server name.' },
      { name: 'Tool', desc: 'The specific tool name to invoke on that server.' },
      { name: 'Arguments', desc: 'JSON arguments passed to the tool, supports {{variable}} interpolation.' },
    ],
    inputs: ['context — data used to build tool arguments'],
    outputs: ['result — tool response as returned by the MCP server'],
    tips: [
      'MCP servers expose tools from file systems, databases, browsers, and APIs.',
      'Check tool schemas in the MCP panel to know expected argument shapes.',
    ],
  },
  memory: {
    summary: 'Reads from or writes to persistent workflow memory. Use it to maintain state across runs, store user preferences, or accumulate history.',
    fields: [
      { name: 'Operation', desc: 'Read — retrieve stored values; Write — save new values.' },
      { name: 'Scope', desc: 'Pod-level (shared), Workflow-level, or User-level memory.' },
      { name: 'Key', desc: 'Identifier for the stored value.' },
      { name: 'Value', desc: 'Data to write (Write operation only). Supports {{variable}} interpolation.' },
      { name: 'TTL', desc: 'Optional time-to-live in seconds before the value expires.' },
    ],
    inputs: ['data — used to build keys or values dynamically'],
    outputs: ['value — the read value (Read); confirmation (Write)'],
    tips: [
      'Use pod-level memory to share state between workflows.',
      'Set a TTL for session-specific data to avoid stale entries.',
    ],
  },
  extract: {
    summary: 'Extracts structured data from unstructured text using an LLM. Specify a JSON schema and the node returns typed, validated fields.',
    fields: [
      { name: 'Input text', desc: 'Source text to extract from. Supports {{variable}} interpolation.' },
      { name: 'Schema', desc: 'JSON Schema defining fields to extract (name, type, description).' },
      { name: 'Model', desc: 'LLM used for extraction.' },
      { name: 'Strict mode', desc: 'Fail if any required schema field is missing from the output.' },
    ],
    inputs: ['text — unstructured content (e.g. email body, document, API response)'],
    outputs: ['extracted — object matching the defined schema'],
    tips: [
      'Write clear field descriptions — they act as prompts for the LLM.',
      'Strict mode is useful for critical pipelines; disable it for exploratory extraction.',
    ],
  },
  retriever: {
    summary: 'Performs semantic search over a knowledge base and returns relevant document chunks. Used to ground agents in factual content.',
    fields: [
      { name: 'Knowledge base', desc: 'Which indexed knowledge source to query.' },
      { name: 'Query', desc: 'Search query — usually the user\'s question or a derived search term.' },
      { name: 'Top K', desc: 'Number of document chunks to return.' },
      { name: 'Similarity threshold', desc: 'Minimum relevance score to include a result (0–1).' },
    ],
    inputs: ['query — text to search with'],
    outputs: ['chunks — array of matching document excerpts with metadata and scores'],
    tips: [
      'Pass Retriever output directly to an Agent\'s system prompt to implement RAG.',
      'Lower the threshold to get more results; raise it for higher precision.',
    ],
  },
  guardrails: {
    summary: 'Validates content against safety, compliance, or custom policies. Blocks or flags content that violates defined rules before it reaches downstream nodes.',
    fields: [
      { name: 'Input', desc: 'The text or data to validate.' },
      { name: 'Policies', desc: 'List of active guardrail policies (e.g. no PII, no harmful content).' },
      { name: 'Action on violation', desc: 'Block (halt execution), Redact (remove violating content), or Flag (annotate and continue).' },
    ],
    inputs: ['content — text or structured data to evaluate'],
    outputs: ['safe — content that passed all checks', 'violation — triggered when action is "Flag"'],
    tips: [
      'Place Guardrails immediately after user-facing inputs.',
      'Use the "Redact" action to sanitize PII before logging.',
    ],
  },
  code: {
    summary: 'Executes a custom JavaScript or Python snippet in a sandboxed environment. Use it for transformations, calculations, or logic that can\'t be expressed in other nodes.',
    fields: [
      { name: 'Language', desc: 'JavaScript or Python.' },
      { name: 'Code', desc: 'The script body. Receives `input` object; must return a value.' },
      { name: 'Timeout', desc: 'Max execution time in milliseconds.' },
    ],
    inputs: ['input — the full workflow context object passed as a variable'],
    outputs: ['output — the return value of the script'],
    tips: [
      'In JS: `return { result: input.value * 2 };`',
      'In Python: `return {"result": input["value"] * 2}`',
      'Avoid network calls from Code nodes — use the HTTP node instead.',
    ],
  },
  loop: {
    summary: 'Iterates over an array and runs the connected subgraph once per item. Supports parallel or sequential execution.',
    fields: [
      { name: 'Iterator', desc: 'Expression resolving to the array to loop over.' },
      { name: 'Item variable', desc: 'Name used to reference the current item inside the loop body.' },
      { name: 'Mode', desc: 'Sequential (one item at a time) or Parallel (all items concurrently).' },
      { name: 'Max concurrency', desc: 'Parallel mode only — max simultaneous executions.' },
    ],
    inputs: ['items — the array to iterate'],
    outputs: ['results — array of outputs from each iteration', 'item — the current iteration\'s output inside the loop'],
    tips: [
      'Use Sequential mode when order or rate limits matter.',
      'Parallel mode is significantly faster for independent items.',
    ],
  },
  parallel: {
    summary: 'Forks execution into multiple simultaneous branches and waits for all to complete before continuing.',
    fields: [
      { name: 'Branches', desc: 'Named output handles — one per parallel path.' },
      { name: 'Wait for all', desc: 'When enabled, halts until every branch finishes (default). Disable to use first-completed mode.' },
    ],
    inputs: ['data — shared context forwarded to every branch'],
    outputs: ['[branch name] — each branch receives the full input context', 'merged — downstream receives all branch outputs combined'],
    tips: [
      'Parallel branches share the same input context but run independently.',
      'Use when fetching from multiple APIs or running independent agents.',
    ],
  },
  wait: {
    summary: 'Pauses workflow execution for a fixed duration or until a specific datetime.',
    fields: [
      { name: 'Mode', desc: 'Duration (wait N seconds/minutes/hours) or Until (wait until a specific ISO timestamp).' },
      { name: 'Duration', desc: 'Wait time in the chosen unit (Duration mode).' },
      { name: 'Until', desc: 'ISO 8601 datetime to resume at (Until mode). Supports {{variable}} interpolation.' },
    ],
    inputs: ['data — passed through unchanged after the wait completes'],
    outputs: ['data — same as input, forwarded after the wait period'],
    tips: [
      'Use Wait between retries or to throttle downstream API calls.',
      'Until mode is useful for scheduling time-sensitive actions.',
    ],
  },
  variables: {
    summary: 'Declares and sets workflow-scoped variables. Use it to initialize or update named values accessible by downstream nodes.',
    fields: [
      { name: 'Variables', desc: 'Name-value pairs to set. Values support {{variable}} interpolation.' },
      { name: 'Merge mode', desc: 'Replace (overwrite existing) or Merge (deep-merge with existing context).' },
    ],
    inputs: ['context — existing workflow state (used for interpolation)'],
    outputs: ['context — updated state with new variables merged in'],
    tips: [
      'Use Variables at the top of a workflow to centralize configuration.',
      'Reference any variable downstream with {{variableName}}.',
    ],
  },
  evaluator: {
    summary: 'Scores or evaluates an agent output using LLM-as-a-judge or rule-based criteria. Useful for quality gates and automated testing.',
    fields: [
      { name: 'Input', desc: 'The content to evaluate (usually an agent output).' },
      { name: 'Criteria', desc: 'Natural language description of what a good output looks like.' },
      { name: 'Scoring', desc: 'Numeric scale (e.g. 1–5) or pass/fail.' },
      { name: 'Model', desc: 'LLM acting as the judge.' },
    ],
    inputs: ['output — the agent response or content to evaluate'],
    outputs: ['score — numeric rating or pass/fail result', 'reasoning — the judge\'s explanation'],
    tips: [
      'Route low-scoring outputs to a retry branch.',
      'Detailed criteria produce more consistent scores.',
    ],
  },
  subworkflow: {
    summary: 'Calls another workflow as a reusable step. Passes data in, waits for completion, and receives the sub-workflow\'s output.',
    fields: [
      { name: 'Workflow', desc: 'The target workflow to invoke (selected by name or ID).' },
      { name: 'Input', desc: 'Data to pass as the sub-workflow\'s trigger payload.' },
      { name: 'Wait for completion', desc: 'Block until the sub-workflow finishes (default). Disable for fire-and-forget.' },
    ],
    inputs: ['input — payload forwarded to the sub-workflow\'s Start node'],
    outputs: ['output — the sub-workflow\'s End node output'],
    tips: [
      'Use Sub-workflow nodes to share logic across multiple workflows without duplication.',
      'Fire-and-forget mode is useful for async notifications or background jobs.',
    ],
  },
  slack: {
    summary: 'Sends a message or file to a Slack channel or DM using a configured Slack integration.',
    fields: [
      { name: 'Channel', desc: 'Target channel name or user ID.' },
      { name: 'Message', desc: 'Text body. Supports Slack markdown and {{variable}} interpolation.' },
      { name: 'Blocks', desc: 'Optional Slack Block Kit JSON for rich message formatting.' },
      { name: 'Thread TS', desc: 'If set, posts as a reply in an existing thread.' },
    ],
    inputs: ['data — used to build message content via interpolation'],
    outputs: ['message — Slack API response with timestamp and channel'],
    tips: [
      'Use Block Kit for interactive messages with buttons.',
      'Store the message timestamp to reply or update it later.',
    ],
  },
  github: {
    summary: 'Interacts with GitHub via the GitHub API — create issues, comment on PRs, push files, and more.',
    fields: [
      { name: 'Action', desc: 'Operation to perform: Create Issue, Add Comment, Create PR, Push File, etc.' },
      { name: 'Repository', desc: 'Owner/repo string (e.g. acme/backend).' },
      { name: 'Payload', desc: 'Action-specific fields (title, body, branch, path, etc.). Supports {{variable}} interpolation.' },
    ],
    inputs: ['data — used for payload interpolation'],
    outputs: ['response — GitHub API response for the action'],
    tips: [
      'Use the Create Issue action to file bugs from workflow monitoring.',
      'Combine with the Retriever node to search code before creating a PR.',
    ],
  },
  notion: {
    summary: 'Reads from or writes to Notion databases and pages using a configured Notion integration.',
    fields: [
      { name: 'Action', desc: 'Create Page, Update Page, Query Database, Append Block, or Read Page.' },
      { name: 'Database / Page ID', desc: 'Target Notion resource ID or URL.' },
      { name: 'Properties', desc: 'Notion page properties to set or update.' },
      { name: 'Content', desc: 'Markdown or block content to append.' },
    ],
    inputs: ['data — used to populate page properties and content'],
    outputs: ['page — Notion API response with the resulting page object'],
    tips: [
      'Use Query Database with filters to find existing records before creating duplicates.',
      'Property names must match your Notion database schema exactly.',
    ],
  },
  gmail: {
    summary: 'Sends emails or reads messages via Gmail using a configured Google account.',
    fields: [
      { name: 'Action', desc: 'Send Email, Read Emails, Search Emails, or Reply.' },
      { name: 'To / From', desc: 'Recipient or sender address filter.' },
      { name: 'Subject', desc: 'Email subject line. Supports {{variable}} interpolation.' },
      { name: 'Body', desc: 'Plain text or HTML email body.' },
      { name: 'Query', desc: 'Gmail search query for Read/Search actions (e.g. "from:boss@acme.com is:unread").' },
    ],
    inputs: ['data — used to build email content via interpolation'],
    outputs: ['result — send confirmation or array of matching messages'],
    tips: [
      'Use Gmail search syntax for powerful filtering in Read actions.',
      'Attach files by passing a base64-encoded string with a filename.',
    ],
  },
  filter: {
    summary: 'Filters an array to keep only elements matching a condition. Uses Jexl expressions evaluated per item.',
    fields: [
      { name: 'Source', desc: 'Variable name holding the array to filter. Defaults to lastOutput.' },
      { name: 'Condition', desc: 'Jexl expression evaluated for each element. Use `item` for the element and `index` for its position.' },
    ],
    inputs: ['array — the source array from an upstream node'],
    outputs: ['filtered — array containing only elements where the condition is truthy'],
    tips: [
      'Examples: item.active == true, item.score > 0.8, index < 5',
      'Items where the condition throws an error are excluded from the result.',
    ],
  },
  merge: {
    summary: 'Combines multiple arrays or objects into one. Supports concat, deep-merge, and zip modes.',
    fields: [
      { name: 'Mode', desc: 'Concat — flatten arrays into one; Merge — deep-merge objects; Zip — pair elements by index.' },
      { name: 'Sources', desc: 'Variable names (one per field) holding the arrays or objects to combine.' },
    ],
    inputs: ['arrays / objects — multiple upstream values to combine'],
    outputs: ['result — the merged array or object'],
    tips: [
      'Concat is the most common mode for combining list results from parallel branches.',
      'Zip is useful for pairing rows from two aligned arrays into tuples.',
    ],
  },
  datetime: {
    summary: 'Formats, parses, and manipulates dates and times without external dependencies.',
    fields: [
      { name: 'Operation', desc: 'Now, Format, Parse, Add, Subtract, or Diff.' },
      { name: 'Input', desc: 'Variable name holding the date string, ISO timestamp, or Unix epoch to operate on.' },
      { name: 'Amount / Unit', desc: 'For Add/Subtract: the quantity and time unit (days, hours, months, etc.).' },
      { name: 'Format', desc: 'Output template. Supports YYYY, MM, DD, HH, mm, ss, ISO, UNIX, UTC.' },
    ],
    inputs: ['date — string, ISO timestamp, or Unix epoch from an upstream node'],
    outputs: ['result — formatted string, parsed components object, or duration object'],
    tips: [
      'Now returns { iso, unix, formatted } so you can use any form downstream.',
      'Diff returns the gap between two dates in ms, seconds, minutes, hours, days, and weeks.',
      'Leave Date B empty in Diff to compare against the current time.',
    ],
  },
  note: {
    summary: 'A non-executing canvas annotation. Use notes to document your workflow with context, reminders, or section labels.',
    tips: [
      'Double-click a Note node on the canvas to edit its text.',
      'Notes do not affect workflow execution — they are purely visual.',
    ],
  },
  frame: {
    summary: 'A resizable container for visually grouping related nodes. Frames have no effect on execution — they are purely organizational.',
    fields: [
      { name: 'Label', desc: 'Double-click the frame name to rename it inline.' },
      { name: 'Color', desc: 'Pick a border color from the palette shown when the frame is selected.' },
      { name: 'Collapse', desc: 'Click the arrow in the frame header to collapse it to just a title bar.' },
      { name: 'Resize', desc: 'Drag the corner handles (visible when selected) to resize the frame.' },
    ],
    tips: [
      'Select multiple nodes and click Group in the toolbar to auto-create a frame around them.',
      'Frames render behind other nodes — drag any node on top of a frame to visually group it.',
      'Frames are saved with the workflow but ignored during execution.',
    ],
  },
};

/* ─── Document tab ───────────────────────────────────────────────── */
function DocumentTab({ node, className }: { node: Node; className?: string }) {
  const nodeType = (node.data.nodeType as string) ?? node.type ?? '';
  const doc = NODE_DOCS[nodeType];

  if (!doc) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center px-4', className)}>
        <HugeiconsIcon icon={NoteAddIcon} className="size-8 text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground">No reference docs available for this node type.</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="py-3 px-3 space-y-4">
        {/* Summary */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Overview</p>
          <p className="text-xs text-foreground leading-relaxed">{doc.summary}</p>
        </div>

        {/* Configuration fields */}
        {doc.fields && doc.fields.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Configuration</p>
            <div className="space-y-1.5">
              {doc.fields.map((f) => (
                <div key={f.name} className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-foreground font-mono">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inputs */}
        {doc.inputs && doc.inputs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Inputs</p>
            <div className="space-y-1">
              {doc.inputs.map((inp) => {
                const [label, ...rest] = inp.split(' — ');
                return (
                  <div key={inp} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-blue-400" />
                    <p className="text-[11px] leading-snug">
                      <span className="font-mono text-foreground">{label}</span>
                      {rest.length > 0 && <span className="text-muted-foreground"> — {rest.join(' — ')}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Outputs */}
        {doc.outputs && doc.outputs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Outputs</p>
            <div className="space-y-1">
              {doc.outputs.map((out) => {
                const [label, ...rest] = out.split(' — ');
                return (
                  <div key={out} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-green-400" />
                    <p className="text-[11px] leading-snug">
                      <span className="font-mono text-foreground">{label}</span>
                      {rest.length > 0 && <span className="text-muted-foreground"> — {rest.join(' — ')}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tips */}
        {doc.tips && doc.tips.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Tips</p>
            <div className="space-y-1.5">
              {doc.tips.map((tip) => (
                <div key={tip} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[10px] text-amber-500 shrink-0">✦</span>
                  <p className="text-[11px] text-muted-foreground leading-snug">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/* ─── Main NodePanel ─────────────────────────────────────────────── */
export function NodePanel({ node, onClose, onUpdate, onDelete, nodes, edges, nodeResult, token, workspaceId, podId, executionId, onRetry }: NodePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('editor');
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [debugResponse, setDebugResponse] = useState<string | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    if (node) setLocalName((node.data.nodeName as string) ?? (node.data.label as string) ?? '');
    setEditingName(false);
    setActiveTab('editor');
    setDebugResponse(null);
    setDebugLoading(false);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDebugExplanation() {
    if (!token || !workspaceId || !podId || !executionId || !node || !nodeResult?.error) return;
    setDebugLoading(true);
    setDebugResponse(null);
    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/debug-node`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            nodeId: node.id,
            nodeType: (node.data.nodeType as string) ?? node.type,
            nodeData: node.data,
            error: nodeResult.error,
          }),
        },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { explanation?: string };
      setDebugResponse(data.explanation ?? 'No explanation returned.');
    } catch {
      setDebugResponse('Could not reach the AI debug endpoint. Ensure the workflow has been deployed and try again.');
    } finally {
      setDebugLoading(false);
    }
  }

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  if (!node) return null;

  const nodeType  = (node.data.nodeType as string) ?? node.type ?? 'agent';
  const typeLabel = nodeTypeLabels[nodeType] ?? nodeType;
  const badgeColor = nodeTypeColors[nodeType] ?? '#6366f1';
  const nodeData  = node.data as Record<string, unknown>;

  function commitName() {
    const trimmed = localName.trim();
    if (trimmed) onUpdate(node!.id, { nodeName: trimmed });
    setEditingName(false);
  }

  function handleUpdate(fields: Record<string, unknown>) {
    onUpdate(node!.id, fields);
  }

  function renderSubPanel() {
    switch (nodeType) {
      case 'agent':    return <AgentPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'http':     return <HttpPanel  data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'transform':return <TransformPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'if-else':  return <LogicPanel data={nodeData} nodeType={nodeType} onUpdate={handleUpdate} />;
      case 'router':   return <RouterPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'start':    return <StartPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'approval': return <ApprovalPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'mcp':      return <McpPanel      data={nodeData} onUpdate={handleUpdate} />;
      case 'memory':   return <MemoryPanel   data={nodeData} onUpdate={handleUpdate} />;
      case 'extract':  return <ExtractPanel  data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'retriever':return <RetrieverPanel data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'guardrails':  return <GuardrailsPanel  data={nodeData} onUpdate={handleUpdate} />;
      case 'code':        return <CodePanel        data={nodeData} onUpdate={handleUpdate} />;
      case 'loop':        return <LoopPanel        data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'parallel':    return <ParallelPanel    data={nodeData} onUpdate={handleUpdate} />;
      case 'wait':        return <WaitPanel        data={nodeData} onUpdate={handleUpdate} />;
      case 'variables':   return <VariablesPanel   data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'evaluator':   return <EvaluatorPanel   data={nodeData} onUpdate={handleUpdate} nodes={nodes} nodeId={node!.id} />;
      case 'subworkflow': return <SubworkflowPanel data={nodeData} onUpdate={handleUpdate} />;
      case 'slack':       return <SlackPanel       data={nodeData} onUpdate={handleUpdate} />;
      case 'github':      return <GitHubPanel      data={nodeData} onUpdate={handleUpdate} />;
      case 'notion':      return <NotionPanel      data={nodeData} onUpdate={handleUpdate} />;
      case 'gmail':       return <GmailPanel       data={nodeData} onUpdate={handleUpdate} />;
      case 'filter':      return <FilterPanel      data={nodeData} onUpdate={handleUpdate} />;
      case 'merge':       return <MergePanel       data={nodeData} onUpdate={handleUpdate} />;
      case 'datetime':    return <DatetimePanel    data={nodeData} onUpdate={handleUpdate} />;
      case 'note':  return <p className="text-xs text-muted-foreground">Double-click the note on the canvas to edit its text.</p>;
      case 'end':   return <p className="text-xs text-muted-foreground">The End node marks workflow termination. No configuration needed.</p>;
      default:      return null;
    }
  }

  const TABS: Array<{ id: PanelTab; icon: typeof Settings01Icon; title: string }> = [
    { id: 'editor',      icon: Settings01Icon,    title: 'Editor'      },
    { id: 'connections', icon: FlowConnectionIcon, title: 'Connections' },
    { id: 'document',    icon: NoteAddIcon,        title: 'Document'    },
  ];

  return (
    <div className="flex h-full flex-row border-l border-border bg-background">
      {/* Vertical tab rail */}
      <div className="flex shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/20 px-1 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            <HugeiconsIcon icon={tab.icon} className="size-4" />
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Header — common across all tabs */}
        <div className="shrink-0 space-y-2 border-b border-border p-3">
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: badgeColor }}
            >
              {typeLabel}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="destructive"
                title="Delete node"
                onClick={() => { onDelete(node.id); onClose(); }}
              >
                <HugeiconsIcon icon={Delete01Icon} />
              </Button>
              <Button size="icon-sm" variant="ghost" title="Close" onClick={onClose}>
                <HugeiconsIcon icon={Cancel01Icon} />
              </Button>
            </div>
          </div>

          {editingName ? (
            <Input
              ref={nameInputRef}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="h-7 text-sm font-semibold"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              title="Click to rename"
              className="block w-full truncate text-left text-sm font-semibold text-foreground hover:text-muted-foreground cursor-text"
            >
              {localName || typeLabel}
            </button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === 'editor' && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="py-3 px-3 space-y-4 mr-2">
              {renderSubPanel()}

              {/* Continue on fail — shown for all executable node types */}
              {nodeType !== 'start' && nodeType !== 'end' && nodeType !== 'note' && nodeType !== 'frame' && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">Continue on fail</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        Skip errors and let the workflow continue
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={!!(nodeData.continueOnFail)}
                      onClick={() => handleUpdate({ continueOnFail: !nodeData.continueOnFail })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
                        nodeData.continueOnFail ? 'bg-foreground' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-3.5 rounded-full bg-background shadow-sm transition-transform ${
                          nodeData.continueOnFail ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}

              {nodeResult && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Run</p>
                      <div className="flex items-center gap-1.5">
                        {nodeResult.durationMs !== undefined && (
                          <span className="text-[10px] text-muted-foreground">{nodeResult.durationMs}ms</span>
                        )}
                        <span className={`text-[10px] font-semibold capitalize ${
                          nodeResult.status === 'completed' ? 'text-green-600' :
                          nodeResult.status === 'failed'    ? 'text-red-500'   :
                          nodeResult.status === 'running'   ? 'text-blue-500'  : 'text-muted-foreground'
                        }`}>{nodeResult.status}</span>
                      </div>
                    </div>

                    {nodeResult.status === 'failed' && (
                      <div className="flex gap-1.5">
                        {onRetry && (
                          <button
                            onClick={onRetry}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <HugeiconsIcon icon={RepeatIcon} className="size-3" />
                            Retry node
                          </button>
                        )}
                        {executionId && (
                          <button
                            onClick={() => void fetchDebugExplanation()}
                            disabled={debugLoading}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                          >
                            {debugLoading
                              ? <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />
                              : <HugeiconsIcon icon={AiBrain01Icon} className="size-3" />}
                            Why did this fail?
                          </button>
                        )}
                      </div>
                    )}

                    {nodeResult.error && (
                      <div className="rounded-md bg-red-50 border border-red-200 p-2 dark:bg-red-950/30 dark:border-red-900">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1">Error</p>
                        <pre className="text-[11px] text-red-700 dark:text-red-400 whitespace-pre-wrap break-all font-mono">{nodeResult.error}</pre>
                      </div>
                    )}

                    {debugResponse && (
                      <div className="rounded-md bg-violet-50 border border-violet-200 p-2 dark:bg-violet-950/30 dark:border-violet-900">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <HugeiconsIcon icon={AiBrain01Icon} className="size-3 text-violet-500 shrink-0" />
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">AI Analysis</p>
                        </div>
                        <p className="text-[11px] text-violet-800 dark:text-violet-300 leading-relaxed whitespace-pre-wrap">{debugResponse}</p>
                      </div>
                    )}

                    {nodeResult.output !== undefined && !nodeResult.error && (
                      <div className="rounded-md bg-muted/40 border border-border p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Output</p>
                        <pre className="text-[11px] text-foreground whitespace-pre-wrap break-all font-mono max-h-48 overflow-y-auto">
                          {typeof nodeResult.output === 'string' ? nodeResult.output : JSON.stringify(nodeResult.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'connections' && (
          <ScrollArea className="flex-1 min-h-0">
            <ConnectionsTab node={node} nodes={nodes} edges={edges} />
          </ScrollArea>
        )}

        {activeTab === 'document' && (
          <DocumentTab node={node} className="flex-1 min-h-0" />
        )}
      </div>
    </div>
  );
}
