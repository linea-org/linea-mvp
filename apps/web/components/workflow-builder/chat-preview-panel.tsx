'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  Add01Icon,
  Cancel01Icon,
  ArrowUp01Icon,
  Loading01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { createApiClient } from '@/lib/api';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface ChatMessage {
  id: string;
  role: 'user' | 'workflow' | 'system';
  content: string;
  typing?: boolean;
  suspended?: boolean;
}

type ExecStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed';

interface SSEEvent {
  type: string;
  output?: unknown;
  error?: string;
  interrupt?: { type?: string; question?: string; message?: string; prompt?: string; choices?: string[] };
}

export interface ChatPreviewPanelProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function extractReply(output: unknown): string {
  if (output === null || output === undefined) return '(no output)';
  if (typeof output === 'string') return output;
  const o = output as Record<string, unknown>;
  if (typeof o['message'] === 'string') return o['message'];
  if (typeof o['result'] === 'string') return o['result'];
  if (typeof o['response'] === 'string') return o['response'];
  if (typeof o['text'] === 'string') return o['text'];
  return JSON.stringify(output, null, 2);
}

/* ------------------------------------------------------------------ */
/*  Bubble                                                              */
/* ------------------------------------------------------------------ */
function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1 text-center max-w-[90%]">
          {msg.content}
        </span>
      </div>
    );
  }
  // workflow bubble
  return (
    <div className="flex gap-2 items-start">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted mt-1">
        <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {msg.typing ? (
          <div className="flex items-center gap-1 py-2 px-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        ) : (
          <div
            className={`rounded-2xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-wrap break-words ${
              msg.suspended
                ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                : 'bg-muted text-foreground'
            }`}
          >
            {msg.content || <span className="text-muted-foreground italic">(empty response)</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel                                                               */
/* ------------------------------------------------------------------ */
export function ChatPreviewPanel({
  workspaceId, podId, workflowId, token, onClose,
}: ChatPreviewPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<ExecStatus>('idle');
  const [suspended, setSuspended] = useState<{ question: string; choices?: string[] } | null>(null);

  const sseAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => { sseAbortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSSEEvent = useCallback((evt: SSEEvent, execId: string) => {
    switch (evt.type) {
      case 'execution_suspended': {
        const q = evt.interrupt?.question ?? evt.interrupt?.message ?? evt.interrupt?.prompt ?? 'Please provide input.';
        setSuspended({ question: q, choices: evt.interrupt?.choices });
        setMessages((prev) => [
          ...prev.filter((m) => !m.typing),
          { id: `w-${Date.now()}`, role: 'workflow', content: q, suspended: true },
        ]);
        setExecStatus('suspended');
        break;
      }
      case 'execution_complete': {
        const reply = extractReply(evt.output);
        setMessages((prev) => [
          ...prev.filter((m) => !m.typing),
          { id: `w-${Date.now()}`, role: 'workflow', content: reply },
        ]);
        setSuspended(null);
        setExecStatus('completed');
        break;
      }
      case 'execution_failed': {
        setMessages((prev) => [
          ...prev.filter((m) => !m.typing),
          { id: `sys-${Date.now()}`, role: 'system', content: `Execution failed: ${evt.error ?? 'Unknown error'}` },
        ]);
        setSuspended(null);
        setExecStatus('failed');
        break;
      }
      default:
        break;
    }
  }, []);

  const startSSE = useCallback(async (execToken: string, execId: string) => {
    sseAbortRef.current?.abort();
    const ac = new AbortController();
    sseAbortRef.current = ac;

    let receivedTerminal = false;
    let lastEventId: string | null = null;

    for (let attempt = 0; attempt <= 5; attempt++) {
      if (ac.signal.aborted) return;
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${execToken}` };
        if (lastEventId) headers['Last-Event-ID'] = lastEventId;

        const resp = await fetch(
          `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/executions/${execId}/events`,
          { headers, signal: ac.signal },
        );
        if (!resp.ok || !resp.body) return;

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('id: ')) { lastEventId = line.slice(4).trim(); continue; }
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as SSEEvent;
              if (evt.type === 'execution_complete' || evt.type === 'execution_failed') {
                receivedTerminal = true;
              }
              handleSSEEvent(evt, execId);
            } catch { /* malformed line */ }
          }
        }

        // If stream ended without a terminal event, poll once
        if (!receivedTerminal && !ac.signal.aborted) {
          try {
            const api = createApiClient(execToken);
            const ex = await api.get<{ status: string; output?: unknown; error?: string | null }>(
              `/workspaces/${workspaceId}/pods/${podId}/executions/${execId}`,
            );
            if (ex.status === 'completed') handleSSEEvent({ type: 'execution_complete', output: ex.output }, execId);
            else if (ex.status === 'failed') handleSSEEvent({ type: 'execution_failed', error: ex.error ?? undefined }, execId);
          } catch { /* best-effort */ }
        }
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (attempt < 5 && !ac.signal.aborted) {
          await new Promise<void>((resolve) => {
            const delay = Math.min(1_000 * 2 ** attempt, 30_000);
            const t = setTimeout(resolve, delay);
            ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
          });
        }
      }
    }
  }, [workspaceId, podId, handleSSEEvent]);

  async function send() {
    const text = inputText.trim();
    if (!text || isSending || execStatus === 'running') return;

    setInputText('');
    setIsSending(true);
    setSuspended(null);

    const typingId = `typing-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
      { id: typingId, role: 'workflow', content: '', typing: true },
    ]);

    try {
      const api = createApiClient(token);
      const ex = await api.post<{ id: string; status: string }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions`,
        { workflowId, input: { message: text } },
      );
      setExecutionId(ex.id);
      setExecStatus('running');
      void startSSE(token, ex.id);
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { id: `sys-${Date.now()}`, role: 'system', content: err instanceof Error ? err.message : 'Failed to start execution' },
      ]);
      setExecStatus('failed');
    } finally {
      setIsSending(false);
    }
  }

  async function answer(text: string) {
    if (!executionId || !text.trim()) return;
    const trimmed = text.trim();
    setInputText('');
    setSuspended(null);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: trimmed },
      { id: `typing-${Date.now()}`, role: 'workflow', content: '', typing: true },
    ]);

    try {
      const api = createApiClient(token);
      await api.patch(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/respond`,
        { answer: trimmed },
      );
      setExecStatus('running');
      void startSSE(token, executionId);
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { id: `sys-${Date.now()}`, role: 'system', content: err instanceof Error ? err.message : 'Failed to send response' },
      ]);
    }
  }

  function startNewChat() {
    sseAbortRef.current?.abort();
    setMessages([]);
    setInputText('');
    setExecutionId(null);
    setSuspended(null);
    setExecStatus('idle');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit() {
    if (suspended) void answer(inputText);
    else void send();
  }

  const inputDisabled = isSending || execStatus === 'running';

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Chat Preview</span>
          {execStatus === 'running' && (
            <span className="flex items-center gap-1 text-[10px] text-blue-500">
              <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
              Running
            </span>
          )}
          {execStatus === 'suspended' && (
            <span className="text-[10px] text-amber-500 font-medium">Waiting for input</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={startNewChat} title="New chat">
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose} title="Close">
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Chat with your workflow</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send a message to test how it responds.
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-2">
                Your message is passed as{' '}
                <code className="font-mono bg-muted px-1 rounded text-foreground/70">input.message</code>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        {suspended && (
          <p className="text-[11px] text-amber-500 leading-snug">
            Workflow is waiting for your reply to:{' '}
            <span className="italic">
              &quot;{suspended.question.length > 80 ? suspended.question.slice(0, 80) + '…' : suspended.question}&quot;
            </span>
          </p>
        )}
        {suspended?.choices && suspended.choices.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suspended.choices.map((c) => (
              <button
                key={c}
                onClick={() => void answer(c)}
                className="rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-2.5 py-0.5 text-[11px] text-amber-900 dark:text-amber-100 hover:bg-amber-100 transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={inputDisabled}
            placeholder={suspended ? 'Your answer…' : 'Send a message…'}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] max-h-32"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <Button
            size="icon-sm"
            disabled={!inputText.trim() || inputDisabled}
            onClick={handleSubmit}
            className="shrink-0"
          >
            <HugeiconsIcon
              icon={execStatus === 'running' ? Loading01Icon : ArrowUp01Icon}
              className={execStatus === 'running' ? 'animate-spin size-3.5' : 'size-3.5'}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
