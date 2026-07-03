'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  AiMagicIcon, Cancel01Icon, Loading03Icon, PlaneIcon,
  Tick02Icon, Alert02Icon, WorkflowSquare01Icon,
  AiBrain01Icon, LinkSquare01Icon, FlowCircleIcon, FlowIcon,
  SourceCodeSquareIcon, MailSend01Icon, CloudUploadIcon, ReloadIcon,
  Calendar01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Kbd } from '@linea/ui/components/kbd';
import type { Node, Edge } from '@xyflow/react';
import { ApiError, friendlyApiError, API_BASE } from '@/lib/api';
import { consumeSseStream } from '@/lib/sse';

export interface GenerateEvent {
  type: 'progress' | 'node_added' | 'edge_added' | 'complete' | 'error';
  message?: string;
  node?: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> };
  edge?: { id: string; source: string; target: string; sourceHandle?: string; label?: string };
  name?: string;
  definition?: {
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>;
    edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; label?: string }>;
  };
}

interface GenerateDialogProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
  onEvent: (event: GenerateEvent) => void;
  onClose: () => void;
}

type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; progress: string[]; nodeCount: number; done: boolean; error?: string };

interface SlashCmd {
  cmd: string;
  icon: IconSvgElement;
  description: string;
}

const NODE_SLASH_CMDS: SlashCmd[] = [
  { cmd: '/agent',     icon: AiBrain01Icon,       description: 'Add an AI agent node'            },
  { cmd: '/http',      icon: LinkSquare01Icon,     description: 'Add an HTTP request node'        },
  { cmd: '/transform', icon: FlowCircleIcon,       description: 'Add a data transform node'       },
  { cmd: '/branch',    icon: FlowIcon,             description: 'Add a conditional if-else node'  },
  { cmd: '/router',    icon: WorkflowSquare01Icon, description: 'Add a router / switch node'      },
  { cmd: '/code',      icon: SourceCodeSquareIcon, description: 'Add a code execution node'       },
  { cmd: '/email',     icon: MailSend01Icon,       description: 'Add an email send node'          },
  { cmd: '/webhook',   icon: CloudUploadIcon,      description: 'Trigger on incoming webhook'     },
  { cmd: '/wait',      icon: Calendar01Icon,       description: 'Add a delay / wait step'         },
  { cmd: '/modify',    icon: AiMagicIcon,          description: 'Modify an existing node'         },
  { cmd: '/replace',   icon: ReloadIcon,           description: 'Replace the entire workflow'     },
];

const EXAMPLES = [
  'Fetch Hacker News top stories, summarize with Claude, post to Slack',
  'When a GitHub issue is created, triage priority with AI and add labels',
  'Scrape a URL, extract key info, return a 3-bullet summary',
  'Add a Slack notification step after the last node',
  'Replace the current workflow with a customer support triage pipeline',
];

export function GenerateDialog({
  workspaceId, podId, workflowId, nodes, edges, onEvent, onClose,
}: GenerateDialogProps) {
  const { getToken } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const filteredCmds = NODE_SLASH_CMDS.filter((c) =>
    c.cmd.slice(1).startsWith(slashQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(slashQuery.toLowerCase()),
  );

  function closeMenu() { setSlashOpen(false); setSlashQuery(''); setSlashIdx(0); }

  function selectSlashCommand(cmd: SlashCmd) {
    setInput(cmd.cmd + ' ');
    closeMenu();
    setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 10);
  }

  const selectSlashCommandRef = useRef(selectSlashCommand);
  selectSlashCommandRef.current = selectSlashCommand;
  const closeMenuRef = useRef(closeMenu);
  closeMenuRef.current = closeMenu;
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && filteredCmds.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((i) => (i + 1) % filteredCmds.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIdx((i) => (i - 1 + filteredCmds.length) % filteredCmds.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const cmd = filteredCmds[slashIdx]; if (cmd) selectSlashCommandRef.current(cmd); return; }
      if (e.key === 'Escape') { e.preventDefault(); closeMenuRef.current(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendRef.current(); }
  }, [slashOpen, filteredCmds, slashIdx]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setInput(next);
    const match = next.match(/^\/(\w*)$/);
    if (match) {
      setSlashQuery(match[1] ?? '');
      setSlashIdx(0);
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  }

  function buildCanvasContext() {
    if (nodes.length === 0) return undefined;
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: [...new Set(nodes.map((n) => n.type ?? 'unknown'))],
      nodeLabels: nodes.map((n) => (n.data?.label as string | undefined) ?? n.id).slice(0, 10),
    };
  }

  function buildHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const turn of turns) {
      if (turn.kind === 'user') {
        history.push({ role: 'user', content: turn.text });
      } else if (turn.done && !turn.error) {
        const summary = turn.progress[turn.progress.length - 1] ?? 'Workflow generated.';
        history.push({ role: 'assistant', content: summary });
      }
    }
    return history;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);

    const userTurn: Turn = { kind: 'user', text };
    const assistantTurn: Turn = { kind: 'assistant', progress: [], nodeCount: 0, done: false };
    setTurns((prev) => [...prev, userTurn, assistantTurn]);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const resp = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/generate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, canvasContext: buildCanvasContext(), history: buildHistory() }),
          signal: ac.signal,
        },
      );

      if (!resp.ok || !resp.body) throw new ApiError(resp.status, resp.statusText || `Request failed with status ${resp.status}`);

      const reader = resp.body.getReader();
      await consumeSseStream<GenerateEvent>(reader, (event) => {
        onEvent(event);
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (!last || last.kind !== 'assistant') return prev;
          if (event.type === 'progress' && event.message)
            return [...next.slice(0, -1), { ...last, progress: [...last.progress, event.message] }];
          if (event.type === 'node_added')
            return [...next.slice(0, -1), { ...last, nodeCount: last.nodeCount + 1 }];
          if (event.type === 'complete') {
            const summary = `Built ${event.definition?.nodes.length ?? 0} nodes, ${event.definition?.edges.length ?? 0} edges`;
            return [...next.slice(0, -1), { ...last, progress: [...last.progress, summary], done: true }];
          }
          if (event.type === 'error')
            return [...next.slice(0, -1), { ...last, progress: [...last.progress, event.message ?? 'Unknown error'], done: true, error: event.message }];
          return prev;
        });
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = friendlyApiError(err);
        setTurns((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.kind !== 'assistant') return prev;
          return [...prev.slice(0, -1), { ...last, done: true, error: msg, progress: [...last.progress, msg] }];
        });
      }
    } finally {
      setBusy(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  const isEmpty = turns.length === 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AiMagicIcon} className="size-4 text-foreground" />
          <span className="text-sm font-semibold">Generate</span>
          {nodes.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {nodes.length} node{nodes.length !== 1 ? 's' : ''} on canvas
            </span>
          )}
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-8">
            <div>
              <HugeiconsIcon icon={AiMagicIcon} className="mx-auto mb-2 size-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">What should we build?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Describe a workflow or ask to modify the canvas.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px]">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setInput(ex); setTimeout(() => textareaRef.current?.focus(), 50); }}
                  className="rounded border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left leading-snug"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) =>
            turn.kind === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-muted px-3 py-2 text-sm text-foreground leading-relaxed">
                  {turn.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted">
                  <HugeiconsIcon icon={AiMagicIcon} className="size-3 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {turn.progress.length === 0 && !turn.done && (
                    <div className="flex gap-1 py-1">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  )}
                  {turn.progress.map((msg, j) => {
                    const isLast = j === turn.progress.length - 1;
                    const isError = !!turn.error && isLast;
                    return (
                      <div key={j} className="flex items-start gap-1.5">
                        <span className="mt-[3px] shrink-0">
                          {isError ? (
                            <HugeiconsIcon icon={Alert02Icon} className="size-3 text-destructive" />
                          ) : isLast && !turn.done ? (
                            <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin text-muted-foreground" />
                          ) : (
                            <HugeiconsIcon icon={Tick02Icon} className="size-3 text-green-500" />
                          )}
                        </span>
                        <span className={`text-xs leading-relaxed ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>{msg}</span>
                      </div>
                    );
                  })}
                  {turn.nodeCount > 0 && (
                    <div className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                      <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3" />
                      {turn.nodeCount} node{turn.nodeCount !== 1 ? 's' : ''} placed
                    </div>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="relative">
          {/* Slash command menu */}
          {slashOpen && filteredCmds.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
              <div className="no-scrollbar overflow-y-auto" style={{ maxHeight: 200 }}>
                <div className="px-1 py-1">
                  {filteredCmds.map((cmd, i) => (
                    <button
                      key={cmd.cmd}
                      onMouseDown={(e) => { e.preventDefault(); selectSlashCommand(cmd); }}
                      className={`group relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-left outline-none select-none transition-colors ${slashIdx === i ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'}`}
                    >
                      <HugeiconsIcon icon={cmd.icon} className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs font-semibold text-primary w-[5.5rem] shrink-0">{cmd.cmd}</span>
                      <span className="truncate flex-1 text-[11px] text-muted-foreground">{cmd.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 border-t border-border/30 px-3 py-1.5">
                <Kbd>↑</Kbd><Kbd>↓</Kbd>
                <span className="text-[10px] text-muted-foreground/40 mr-2">navigate</span>
                <Kbd>↵</Kbd>
                <span className="text-[10px] text-muted-foreground/40 mr-2">select</span>
                <Kbd>esc</Kbd>
                <span className="text-[10px] text-muted-foreground/40">dismiss</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-background focus-within:ring-1 focus-within:ring-ring/50 transition-all overflow-hidden">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={isEmpty ? 'Describe a workflow to build…' : 'Follow up or ask to modify…'}
              className="w-full resize-none bg-transparent text-sm text-foreground outline-none px-3 pt-2.5 pb-1.5 min-h-[48px] max-h-36 leading-relaxed placeholder:text-muted-foreground/60"
              rows={2}
              disabled={busy}
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-[10px] text-muted-foreground/50">
                <kbd className="rounded border border-border px-1 text-[8px]">/</kbd> for node commands
                &nbsp;·&nbsp;
                Shift+Enter for newline
              </p>
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || busy}
                className="flex size-6 shrink-0 items-center justify-center rounded bg-foreground text-background hover:opacity-80 disabled:opacity-30 transition-opacity"
              >
                <HugeiconsIcon
                  icon={busy ? Loading03Icon : PlaneIcon}
                  className={`size-3 ${busy ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
