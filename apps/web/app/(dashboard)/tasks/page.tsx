"use client"

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, PlaneIcon,
  WorkflowSquare01Icon, Database01Icon, ArrowDown01Icon,
  Attachment01Icon, Mic01Icon,
  Cancel01Icon,
  ArrowRight01Icon, AiMagicIcon,
  HelpCircleIcon,
  ArrowLeft01Icon,
} from '@hugeicons/core-free-icons';
import { usePod } from '@/contexts/space-context';
import { useWorkspace } from '@/contexts/workspace-context';
import { useApiClient } from '@/hooks/use-api-client';
import { friendlyApiError } from '@/lib/api';
import { consumeSseStream } from '@/lib/sse';
import { toast } from '@linea/ui/components/sonner';
import { Button } from '@linea/ui/components/button';
import { PageSpinner } from '@linea/ui/components/page-spinner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import { Kbd } from '@linea/ui/components/kbd';
import { MessageBubble } from './message-bubble';
import { HistorySidebar } from './history-sidebar';
import { AttachMenu } from './attach-menu';
import { useSpeechRecognition } from './use-speech-recognition';
import { useModelCatalog } from './use-model-catalog';
import {
  API_BASE, DEFAULT_MODEL_ID,
  SLASH_COMMANDS, PRESETS, TICKER_PROMPTS, PROVIDER_LABELS,
} from './constants';
import type { Message, Session, Attachment, SSEEvent } from './types';

function TasksPageInner() {
  const { getToken } = useAuth();
  const getApi = useApiClient();
  const { activeWorkspace } = useWorkspace();
  const { activePod } = usePod();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState(() => `s-${Date.now()}`);
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const { data: modelList = [] } = useModelCatalog();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['pod-workflows-list', activeWorkspace?.id, activePod?.id],
    enabled: !!activeWorkspace?.id && !!activePod?.id,
    queryFn: async () => {
      const api = await getApi();
      const data = await api.get<{ id: string; name: string }[]>(
        `/workspaces/${activeWorkspace!.id}/pods/${activePod!.id}/workflows`,
      );
      return Array.isArray(data) ? data : [];
    },
  });

  /* slash command state */
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [slashIdx, setSlashIdx] = useState(0)

  /* animated placeholder */
  const [tickerIdx, setTickerIdx] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const slashScrollRef = useRef<HTMLDivElement>(null);

  const { isListening, toggle: toggleMic } = useSpeechRecognition((transcript) =>
    handleInputChange(input ? `${input} ${transcript}` : transcript),
  );

  const hasMessages = messages.length > 0

  const filteredSlash = SLASH_COMMANDS.filter((c) =>
    c.cmd.slice(1).startsWith(slashQuery.toLowerCase())
  )

  useEffect(() => {
    if (!activeWorkspace) return
    void (async () => {
      try {
        const api = await getApi();
        const rows = await api.get<Array<{ id: string; threadId: string; title: string; messages: unknown[]; createdAt: string }>>(`/workspaces/${activeWorkspace.id}/agent/sessions`);
        setSessions(rows.map((r) => ({
          id: r.threadId,
          dbId: r.id,
          title: r.title,
          createdAt: new Date(r.createdAt).getTime(),
          messages: (r.messages ?? []) as Message[],
        })));
      } catch (err) {
        toast.error(friendlyApiError(err));
      }
    })();
  }, [activeWorkspace?.id, getApi]);

  // Auto-load session from URL ?s=<threadId> once sessions are available
  useEffect(() => {
    const sid = searchParams.get("s")
    if (!sid || sessions.length === 0) return
    const match = sessions.find((s) => s.id === sid)
    if (match && match.id !== sessionId) {
      abortRef.current?.abort()
      setMessages(
        (match.messages ?? []).map((m) => ({ ...m, streaming: false }))
      )
      setSessionId(match.id)
      setIsStreaming(false)
      setAttachments([])
    }
  }, [sessions, searchParams, sessionId]);

  useEffect(() => {
    if (hasMessages) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, hasMessages])
  useEffect(() => {
    if (!slashOpen) return
    const active = slashScrollRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: "nearest" })
  }, [slashIdx, slashOpen])

  /* Cycle ticker prompts when idle */
  useEffect(() => {
    if (input || isStreaming || isFocused) return
    const t = setInterval(() => {
      setTickerVisible(false)
      setTimeout(() => {
        setTickerIdx((i) => (i + 1) % TICKER_PROMPTS.length)
        setTickerVisible(true)
      }, 220)
    }, 3200)
    return () => clearInterval(t)
  }, [input, isStreaming, isFocused])

  function resizeTextarea() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }

  async function upsertSession(
    msgs: Message[],
    sid: string,
    firstUserMsg: string
  ) {
    const title = firstUserMsg.slice(0, 60)
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sid)
      const next: Session = {
        id: sid,
        dbId: existing?.dbId,
        title,
        createdAt: existing?.createdAt ?? Date.now(),
        messages: msgs,
      }
      return [next, ...prev.filter((s) => s.id !== sid)]
    })
    if (!activeWorkspace) return
    try {
      const api = await getApi();
      const saved = await api.post<{ id: string; threadId: string }>(
        `/workspaces/${activeWorkspace.id}/agent/sessions`,
        { threadId: sid, title, messages: msgs },
      );
      setSessions((prev) => prev.map((s) => s.id === sid ? { ...s, dbId: saved.id } : s));
    } catch (err) {
      toast.error(friendlyApiError(err));
    }
  }

  function startNewChat() {
    abortRef.current?.abort()
    setMessages([])
    setInput("")
    setAttachments([])
    setSessionId(`s-${Date.now()}`)
    setIsStreaming(false)
    router.push("/tasks", { scroll: false })
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  function loadSession(s: Session) {
    abortRef.current?.abort()
    setMessages((s.messages ?? []).map((m) => ({ ...m, streaming: false })))
    setSessionId(s.id)
    setIsStreaming(false)
    setAttachments([])
    router.push(`/tasks?s=${encodeURIComponent(s.id)}`, { scroll: false })
  }

  async function deleteSession(id: string) {
    const session = sessions.find((s) => s.id === id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (id === sessionId) startNewChat()
    if (session?.dbId && activeWorkspace) {
      try {
        const api = await getApi();
        await api.delete(`/workspaces/${activeWorkspace.id}/agent/sessions/${session.dbId}`);
      } catch (err) {
        toast.error(friendlyApiError(err));
      }
    }
  }

  function getHistory(currentMessages: Message[]) {
    return currentMessages
      .filter((m) => m.content)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
  }

  function handleInputChange(val: string) {
    setInput(val)
    resizeTextarea()
    const match = val.match(/^\/(\w*)$/)
    if (match) {
      setSlashQuery(match[1] ?? "")
      setSlashIdx(0)
      setSlashOpen(true)
    } else {
      setSlashOpen(false)
    }
  }

  function selectSlashCommand(cmd: (typeof SLASH_COMMANDS)[number]) {
    setInput(cmd.cmd + " ")
    setSlashOpen(false)
    setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
      resizeTextarea()
    }, 10)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = () => {
        const content =
          typeof reader.result === "string" ? reader.result : undefined
        setAttachments((prev) => [
          ...prev,
          {
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            type: "file",
            content,
            fileType: file.type,
          },
        ])
      }
      if (file.type.startsWith("text/") || file.type === "application/json") {
        reader.readAsText(file)
      } else {
        reader.readAsDataURL(file)
      }
    }
    e.target.value = ""
  }

  function attachWorkflow(wf: { id: string; name: string }) {
    if (attachments.some((a) => a.workflowId === wf.id)) return
    setAttachments((prev) => [
      ...prev,
      {
        id: `w-${wf.id}`,
        name: wf.name,
        type: "workflow",
        workflowId: wf.id,
        content: `Workflow: ${wf.name} (ID: ${wf.id})`,
      },
    ])
  }

  function attachConnector(id: string, label: string) {
    if (attachments.some((a) => a.connectorId === id)) return
    setAttachments((prev) => [
      ...prev,
      {
        id: `c-${id}`,
        name: label,
        type: "connector",
        connectorId: id,
        content: `External connector context: ${label}`,
      },
    ])
  }

  function attachMemory() {
    const already = attachments.some((a) => a.id === "memory")
    if (already) return
    setAttachments((prev) => [
      ...prev,
      {
        id: "memory",
        name: "Knowledge base",
        type: "memory",
        content: "Include relevant knowledge base context in your response.",
      },
    ])
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  function handleFeedback(messageId: string, vote: 'up' | 'down') {
    setFeedback((prev) => {
      if (prev[messageId] === vote) {
        const next = { ...prev }
        delete next[messageId]
        return next
      }
      return { ...prev, [messageId]: vote }
    })
  }

  function buildContent(text: string, atts: Attachment[]): string {
    if (!atts.length) return text
    const parts = [text]
    for (const a of atts) {
      if (a.type === "workflow") {
        parts.push(
          `\n\n[Attached workflow context: ${a.name} (ID: ${a.workflowId})]`
        )
      } else if (a.type === "connector") {
        parts.push(`\n\n[External connector attached: ${a.name}]`)
      } else if (a.type === "memory") {
        parts.push(`\n\n[Include relevant knowledge base context]`)
      } else if (
        a.fileType?.startsWith("text/") ||
        a.fileType === "application/json"
      ) {
        parts.push(`\n\n[File: ${a.name}]\n\`\`\`\n${a.content ?? ""}\n\`\`\``)
      } else {
        parts.push(`\n\n[Attached file: ${a.name}]`)
      }
    }
    return parts.join("")
  }

  const handleEvent = useCallback((evt: SSEEvent, assistantId: string) => {
    if (evt.type === "text_delta" && evt.delta) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + evt.delta! } : m
        )
      )
    } else if (evt.type === "step_start" && evt.id && evt.name) {
      // Tool starting — add a placeholder immediately so UI shows progress before input arrives
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                toolCalls: [
                  ...(m.toolCalls ?? []).filter((tc) => tc.id !== evt.id!),
                  { id: evt.id!, name: evt.name!, input: {} },
                ],
              }
            : m
        )
      )
    } else if (evt.type === "tool_call" && evt.id && evt.name) {
      // Full tool call with input — update the placeholder created by step_start
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                toolCalls: (m.toolCalls ?? []).map((tc) =>
                  tc.id === evt.id ? { ...tc, input: evt.input ?? {} } : tc
                ),
              }
            : m
        )
      )
    } else if (evt.type === "tool_result" && evt.id) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                toolCalls: (m.toolCalls ?? []).map((tc) =>
                  tc.id === evt.id ? { ...tc, result: evt.result } : tc
                ),
              }
            : m
        )
      )
    } else if (evt.type === "error") {
      console.log(evt)
    }
  }, [])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || isStreaming || !activeWorkspace) return

    const currentAttachments = [...attachments]
    const fullContent = buildContent(text, currentAttachments)

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      attachments: currentAttachments,
    }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      toolCalls: [],
      streaming: true,
      model,
    }

    setAttachments([])
    setMessages((prev) => {
      const next = [...prev, userMsg, assistantMsg]
      const firstMsg = prev.find((m) => m.role === "user")?.content ?? text
      void upsertSession(next, sessionId, firstMsg)
      return next
    })
    setInput("")
    setSlashOpen(false)
    resizeTextarea()
    setIsStreaming(true)

    const token = await getToken()
    if (!token) {
      setIsStreaming(false)
      return
    }

    abortRef.current = new AbortController()

    try {
      const history = getHistory(messages);
      const res = await fetch(`${API_BASE}/workspaces/${activeWorkspace.id}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: fullContent }],
          context: activePod ? { podId: activePod.id, podName: activePod.name } : undefined,
          model,
          threadId: sessionId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      await consumeSseStream<SSEEvent>(reader, (evt) => handleEvent(evt, assistantId));
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  m.content || "*Something went wrong. Please try again.*",
                streaming: false,
              }
            : m
        )
      )
    } finally {
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id !== assistantId) return m
          // Resolve any tool calls that never got a result (stream died mid-call)
          const toolCalls = (m.toolCalls ?? []).map((tc) =>
            tc.result !== undefined
              ? tc
              : {
                  ...tc,
                  result: { error: "Stream ended before result was received" },
                }
          )
          return { ...m, streaming: false, toolCalls }
        })
        const firstMsg = prev.find((m) => m.role === "user")?.content ?? ""
        void upsertSession(next, sessionId, firstMsg)
        return next
      })
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSlashIdx((i) => (i + 1) % filteredSlash.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSlashIdx(
          (i) => (i - 1 + filteredSlash.length) % filteredSlash.length
        )
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        const cmd = filteredSlash[slashIdx]
        if (cmd) selectSlashCommand(cmd)
        return
      }
      if (e.key === "Escape") {
        setSlashOpen(false)
        return
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function stop() {
    abortRef.current?.abort()
    setIsStreaming(false)
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    )
  }

  const currentModel = modelList.find((m) => m.id === model) ?? { id: model, label: model, hint: '', provider: '' }
  const modelProviders = Array.from(new Set(modelList.map((m) => m.provider)))
  const modelsByProvider = Object.fromEntries(
    modelProviders.map((p) => [p, modelList.filter((m) => m.provider === p)]),
  )

  const inputBox = (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-all focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/50">
      {slashOpen && filteredSlash.length > 0 && (
        <div className="animate-in border-b border-border/50 duration-150 fade-in-0 slide-in-from-bottom-2">
          <div
            ref={slashScrollRef}
            className="no-scrollbar overflow-y-auto"
            style={{ maxHeight: 176 }}
          >
            <div className="px-1 py-1">
              {filteredSlash.map((cmd, idx) => (
                <button
                  key={cmd.cmd}
                  data-active={slashIdx === idx}
                  onClick={() => selectSlashCommand(cmd)}
                  className={`group relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors outline-none select-none ${slashIdx === idx ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted/50"}`}
                >
                  <HugeiconsIcon
                    icon={cmd.icon}
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="w-[5rem] shrink-0 font-mono text-xs font-semibold text-primary">
                    {cmd.cmd}
                  </span>
                  <span className="flex-1 truncate text-[11px] text-muted-foreground">
                    {cmd.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 border-t border-border/30 px-3 py-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span className="mr-2 text-[10px] text-muted-foreground/40">
              navigate
            </span>
            <Kbd>↵</Kbd>
            <span className="mr-2 text-[10px] text-muted-foreground/40">
              select
            </span>
            <Kbd>esc</Kbd>
            <span className="text-[10px] text-muted-foreground/40">
              dismiss
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileSelect}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground"
            >
              <HugeiconsIcon
                icon={
                  a.type === "workflow"
                    ? WorkflowSquare01Icon
                    : a.type === "memory"
                      ? Database01Icon
                      : Attachment01Icon
                }
                className="size-3 shrink-0 text-muted-foreground"
              />
              <span className="max-w-[120px] truncate">{a.name}</span>
              <button
                onClick={() => removeAttachment(a.id)}
                className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-3">
        <div className="relative min-h-[1.5rem] flex-1">
          <textarea
            ref={textareaRef}
            placeholder=""
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isStreaming}
            rows={1}
            className="max-h-40 min-h-[1.5rem] w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none"
          />
          {!input && (
            <p
              aria-hidden
              className={`pointer-events-none absolute inset-0 text-sm leading-relaxed transition-all duration-200 select-none ${
                tickerVisible && !isFocused && !isStreaming
                  ? "translate-y-0 opacity-100"
                  : "translate-y-1 opacity-0"
              } ${isStreaming ? "text-muted-foreground/40" : "text-muted-foreground/50"}`}
            >
              {isStreaming
                ? "Linea Agent is thinking…"
                : TICKER_PROMPTS[tickerIdx]}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 self-end">
          <button
            onClick={toggleMic}
            disabled={isStreaming}
            title={isListening ? "Stop listening" : "Voice input"}
            className={`flex size-7 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
              isListening
                ? "animate-pulse bg-red-500/10 text-red-500"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <HugeiconsIcon icon={Mic01Icon} className="size-4" />
          </button>
          {isStreaming ? (
            <button
              onClick={stop}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted"
              title="Stop"
            >
              <span className="size-3 rounded-sm bg-foreground" />
            </button>
          ) : (
            <button
              onClick={() => void send()}
              disabled={!input.trim() || !activeWorkspace}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-30"
              title="Send (Enter)"
            >
              <HugeiconsIcon icon={PlaneIcon} className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 border-t border-border/50 px-3 py-1.5">
        <AttachMenu
          disabled={isStreaming}
          workflows={workflows}
          workflowsLoading={workflowsLoading}
          attachments={attachments}
          onFile={() => fileInputRef.current?.click()}
          onWorkflow={attachWorkflow}
          onConnector={attachConnector}
          onMemory={attachMemory}
        />
        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
              <span className="font-medium">{currentModel.label}</span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="size-3 opacity-60"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            className="max-h-[360px] w-52 overflow-y-auto"
          >
            {modelProviders.map((provider, pi) => (
              <div key={provider}>
                {pi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="px-2 py-1 text-[10px] font-normal tracking-widest text-muted-foreground uppercase">
                  {PROVIDER_LABELS[provider] ?? provider}
                </DropdownMenuLabel>
                {(modelsByProvider[provider] ?? []).map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <span className="flex-1 truncate text-xs">{m.label}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {m.badge && (
                        <span className="hidden rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary sm:block">
                          {m.badge.replace(/-/g, " ")}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {m.hint}
                      </span>
                      {model === m.id && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  const presetChips = (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => void send(p.prompt)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
        >
          <HugeiconsIcon icon={p.icon} className="size-3.5 shrink-0" />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )

  if (!activeWorkspace) {
    return (
      <div className="-m-6 flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a workspace to use Linea Agent.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 bg-background overflow-hidden">
      <div
        className="shrink-0 overflow-hidden transition-all duration-200"
        style={{ width: sidebarOpen ? 240 : 0 }}
      >
        {sidebarOpen && (
          <HistorySidebar
            sessions={sessions}
            currentId={sessionId}
            onLoad={(s) => {
              loadSession(s)
            }}
            onNew={startNewChat}
            onDelete={(id) => void deleteSession(id)}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant={sidebarOpen ? "secondary" : "ghost"}
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle conversation history"
            >
              <HugeiconsIcon
                icon={sidebarOpen ? ArrowLeft01Icon : ArrowRight01Icon}
                className="size-4"
              />
            </Button>
            {hasMessages && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={startNewChat}
                title="New conversation"
              >
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600">
              <HugeiconsIcon icon={AiMagicIcon} className="size-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Linea Agent
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              title="Help & docs"
              onClick={() => window.open("https://docs.linea.build", "_blank")}
            >
              <HugeiconsIcon icon={HelpCircleIcon} className="size-4" />
            </Button>
          </div>
        </div>

        {!hasMessages ? (
          /* Idle: centered */
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-12">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
                <HugeiconsIcon icon={AiMagicIcon} className="size-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                What can I automate for you?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Build workflows, run tasks, check integrations with AI
              </p>
            </div>
            <div className="w-full max-w-2xl">
              {inputBox}
              {presetChips}
            </div>
          </div>
        ) : (
          /* Chat */
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mx-auto max-w-2xl space-y-6">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    feedbackVote={feedback[msg.id]}
                    onFeedback={
                      msg.role === "assistant"
                        ? (v) => handleFeedback(msg.id, v)
                        : undefined
                    }
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="shrink-0 px-6 pb-6">
              <div className="mx-auto max-w-2xl">{inputBox}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <TasksPageInner />
    </Suspense>
  )
}
