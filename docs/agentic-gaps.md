# Agentic System Gaps

Current state as of 2026-05-21. Gaps are grouped by theme, with a rough priority
(`P1` = blocking for production reliability, `P2` = significant UX/product gap, `P3` = nice-to-have).

---

## 1. SSE / Streaming Resilience  `P1`

| Gap | Detail |
|-----|--------|
| **No SSE event replay** | If a client drops mid-execution (mobile network blip, browser tab hide), all events emitted during the disconnect are lost. Reconnecting starts a dead stream. Sim Studio solves this with Redis-backed event buffering + `Last-Event-ID` replay. |
| **No agent-chat streaming persistence** | `agent-chat.service.ts` emits `text_delta` / `tool_call` events via the async channel, but they aren't stored anywhere. Page refresh = blank slate even if the run is still live. |
| **Workflow executor has no token streaming** | `agent.executor.ts` calls the model and waits for the full response before emitting `node_update`. The execution panel shows nothing until the node completes. Only `agent-chat` has token-level streaming. |

---

## 2. Execution Resilience & Checkpointing  `P1`

| Gap | Detail |
|-----|--------|
| **agent-chat has no LangGraph checkpointing** | The `CheckpointerService` (PostgresSaver) is wired into the workflow executor via `langgraph.service.ts`, but the new `agent-chat.service.ts` LangGraph graph is compiled without a checkpointer. Server restart mid-conversation = lost state. |
| **No run-from-node** | To debug a failing step 7 of a 10-step workflow, the user must re-run from node 1. Sim Studio lets you resume from any block. Our PostgresSaver supports this natively — we just don't expose it. |
| **No wall-clock execution timeout** | `maxSteps` caps loop iterations, but a single slow tool call (e.g., a hanging HTTP request) can block execution indefinitely. No per-run deadline. |
| **Human approval has no timeout** | `interrupt()` for `ask_human` / tool approval waits forever. If the user never responds, the execution stays suspended in Postgres until manually aborted. |

---

## 3. Memory System  `P2`

| Gap | Detail |
|-----|--------|
| **Embedding is OpenAI-only** | `MemoryService.generateEmbedding` is hardcoded to `text-embedding-3-small` (1536d). The pgvector column is 1536d. Any workspace using only Google/Anthropic/Groq silently falls back to keyword search. |
| **agent-chat has zero memory** | `agent-chat.service.ts` builds the message history from the incoming DTO only. There is no session memory, no long-term memory, no cross-conversation persistence. Each `/tasks` conversation starts from scratch. |
| **Memory search is sequential scan fallback** | When no embedding is available, `readEntries` and `searchSemantic` do `LIKE` full-table scans — unacceptable at scale. No full-text index (GIN/tsvector) in place as a middle tier. |
| **No cross-workflow memory sharing** | Memory is scoped to `thread | session | workflow`. There is no `workspace`-scope memory that an agent could read from any workflow in the same workspace. |

---

## 4. Tool Execution  `P2`

| Gap | Detail |
|-----|--------|
| **Sequential tool calls** | When the LLM returns multiple tool calls in one turn (which Anthropic, OpenAI, and Google all support), we execute them one-by-one in a `for` loop. Independent tools (e.g., two `memory_search` calls) could run in parallel with `Promise.all`. |
| **No tool result caching** | Deterministic tools (`memory_search`, `read_variable`, `datetime`) are re-executed on every call. No memoization within a single execution or across executions. |
| **No tool-level retry** | Tool failures surface immediately as `Error: ...` in the tool result message. There is no retry wrapper — the LLM has to decide to retry by calling the tool again. |
| **agent-chat toolset is narrow** | Linea Agent (`/tasks`) has only 5 tools: `check_workspace_secrets`, `list_pods`, `list_workflows`, `create_workflow`, `run_workflow`. It cannot: inspect execution logs, read node outputs, trigger webhooks, manage schedules, or read knowledge bases. |
| **No MCP tools in agent-chat** | Workflow agent nodes can call MCP servers. The Linea Agent cannot — `agent-chat.service.ts` has no MCP integration. |

---

## 5. Context Window Management  `P2`

| Gap | Detail |
|-----|--------|
| **Token estimation is a rough approximation** | `trimToTokenBudget` uses `JSON.stringify(messages).length / 4`. This is consistently inaccurate for non-English text, code, and JSON — off by 30–50% in practice. Should use tiktoken or model-specific tokenizers. |
| **Oldest-first drop is semantically unaware** | When context is full, we drop the oldest messages. This can cut the system prompt context, important early user instructions, or tool results that are still relevant. Should summarize old turns rather than drop them. |
| **No per-step token budget** | `contextBudgetPct` is a global per-execution setting. There is no limit on tokens consumed by a single tool result — a large API response can dominate the context even with `TOOL_RESULT_MAX_CHARS`. |

---

## 6. Observability & Debugging  `P2`

| Gap | Detail |
|-----|--------|
| **No distributed tracing** | No LangSmith, OpenTelemetry, or any trace correlation across nodes. When an execution fails, you have server logs and the tool call log — nothing structured you can query. |
| **Tool call logs not persisted per-workspace** | `__toolCallLog` is written to the execution output but not stored in a separate queryable table. Can't ask "how often does tool X fail across all executions this week?" |
| **No agent-chat history** | The `/tasks` conversation is not persisted server-side. Refresh the page = conversation gone. No way to revisit past agent interactions. |
| **No LangGraph trace in execution panel** | The execution detail page shows node-level status but not the agent's internal step-by-step reasoning (which tool it called at step 3, what the LLM said, etc.). |

---

## 7. Reliability & Rate Limiting  `P2`

| Gap | Detail |
|-----|--------|
| **No exponential backoff** | Provider API calls in `client.factory.ts` fail immediately on rate limit (429) or transient errors. No retry-with-jitter wrapper. |
| **No provider fallback** | If the configured model provider is unavailable, the execution fails. No ability to say "try `claude-sonnet-4-6`, fall back to `gpt-4o` if it fails." |
| **No per-workspace concurrency cap** | A single workspace can trigger unlimited concurrent executions. Nothing prevents saturating provider API limits or server resources. |
| **No token/cost budget enforcement** | `totalUsage` is tracked and stored, but there are no spend caps. A runaway agent loop (`maxSteps` notwithstanding) has no cost guardrail. |

---

## 8. Structured Output  `P3`

| Gap | Detail |
|-----|--------|
| **No schema validation** | `outputSchema` in agent nodes parses the LLM response as JSON but does not validate it against the schema. An LLM that produces `{"name": 123}` when the schema says `{"name": {"type": "string"}}` passes silently. |
| **No structured-output retry** | If JSON parsing fails (LLM wraps output in prose), we leave `finalValue` as a string. There is no "please try again, your output was not valid JSON" retry loop. |

---

## 9. Multi-agent Coordination  `P3`

| Gap | Detail |
|-----|--------|
| **No agent-to-agent messaging** | The `parallel.executor.ts` runs workflow branches concurrently, but agents in different branches cannot communicate mid-run. No shared scratchpad. |
| **No supervisor/subagent delegation** | An agent node cannot spin up a sub-agent with a different model/tool set and wait for its result. Must be wired as separate workflow nodes. |
| **No streaming for Linea Agent → workflow** | When `run_workflow` is called in `agent-chat`, it polls every 2 s and returns after completion. The user gets no live progress from the sub-workflow while waiting. |

---

## 10. Prompt & Model Management  `P3`

| Gap | Detail |
|-----|--------|
| **System prompts are hardcoded** | The Linea Agent system prompt is a string literal in `agent-chat.service.ts`. No versioning, no ability to A/B test, no per-workspace prompt override. |
| **No prompt performance metrics** | There is no link between prompt text and execution outcomes. Can't tell if changing a system prompt improved task success rates. |
| **No model fallback at the node level** | Agent nodes pick a model from the registry. If that model is over quota, the node fails. No per-node fallback chain. |

---

## What We Have That's Solid

- **PostgresSaver checkpointing** wired into workflow executions — LangGraph state survives server restarts for workflow runs
- **`interrupt()` for ask_human / tool approval** in workflow agent nodes — clean pause/resume primitive
- **6-provider token streaming** across Anthropic, OpenAI, Groq, xAI, Google, Ollama
- **Execution supervisor** — LLM-backed retry/skip/abort decisions on node failure
- **AES-256-GCM secret encryption** for API keys, OAuth tokens, MCP credentials
- **pgvector semantic search** for long-term memory (when OpenAI key is available)
- **MCP server support** in workflow agent nodes
- **Per-workspace BYOK** — each workspace can bring their own provider keys

---

## Recommended Build Order

1. **SSE Redis replay** — P1, directly impacts user trust (every dropped connection is a confused user)
2. **Wire checkpointer into agent-chat** — P1, 10-line change, prevents lost conversations
3. **Parallel tool execution** — P2, straightforward `Promise.all`, immediate latency win
4. **agent-chat memory** — P2, without it the Linea Agent is amnesiac
5. **Token streaming for workflow nodes** — P2, execution panel feels dead without it
6. **Run-from-node** — P2, major debugging quality-of-life
7. **Structured output validation + retry** — P3
8. **Provider fallback chain** — P3
