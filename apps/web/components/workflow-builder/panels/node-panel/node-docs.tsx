import { HugeiconsIcon } from '@hugeicons/react';
import { NoteAddIcon } from '@hugeicons/core-free-icons';
import type { Node } from '@xyflow/react';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { cn } from '@linea/ui/lib/utils';

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

export function DocumentTab({ node, className }: { node: Node; className?: string }) {
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
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Overview</p>
          <p className="text-xs text-foreground leading-relaxed">{doc.summary}</p>
        </div>

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
