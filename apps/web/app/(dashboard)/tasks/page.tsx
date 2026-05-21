'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Loading01Icon,
  Copy01Icon, CheckmarkCircle01Icon, Add01Icon, PlaneIcon,
  WorkflowSquare01Icon, Database01Icon, ArrowDown01Icon,
  Attachment01Icon, Mic01Icon, ThumbsUpIcon, ThumbsDownIcon,
  Cancel01Icon, AiBrain01Icon, Search01Icon, FlowCircleIcon,
  ArrowRight01Icon, AiMagicIcon, FlowIcon, Calendar01Icon,
  LinkSquare01Icon, CloudUploadIcon, HelpCircleIcon,
  Settings01Icon, ArrowLeft01Icon,
  MailSend01Icon, SourceCodeSquareIcon, Message01Icon, StickyNote01Icon,
  ReloadIcon, UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { usePod } from '@/contexts/space-context';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@linea/ui/components/dropdown-menu';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { Kbd } from '@linea/ui/components/kbd';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface ToolCall {
  id: string; name: string; input: Record<string, unknown>; result?: unknown;
}
interface Attachment {
  id: string; name: string; type: 'file' | 'workflow' | 'memory' | 'connector';
  content?: string; workflowId?: string; fileType?: string; connectorId?: string;
}
interface Message {
  id: string; role: 'user' | 'assistant'; content: string;
  toolCalls?: ToolCall[]; streaming?: boolean;
  attachments?: Attachment[]; model?: string;
}
interface Session {
  id: string;       // threadId — used as LangGraph thread_id
  dbId?: string;    // DB row UUID — used for delete/patch API calls
  title: string;
  createdAt: number;
  messages: Message[];
}
interface SSEEvent {
  type: string; delta?: string; id?: string; name?: string;
  input?: Record<string, unknown>; result?: unknown;
}
interface CreatedWorkflow { id: string; name: string; podId?: string }

/* ─── Models ─────────────────────────────────────────────────────────────── */
interface ModelOption { id: string; label: string; hint: string; provider: string; badge?: string }

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', xai: 'xAI (Grok)',
  groq: 'Groq', google: 'Google', ollama: 'Ollama (Local)',
};

const MODEL_LIST: ModelOption[] = [
  { id: 'claude-sonnet-4-6',              label: 'Claude Sonnet 4.6',     hint: 'Balanced',    provider: 'anthropic', badge: 'best-for-agents' },
  { id: 'claude-opus-4-7',               label: 'Claude Opus 4.7',       hint: 'Powerful',    provider: 'anthropic', badge: 'most-capable'   },
  { id: 'claude-haiku-4-5',              label: 'Claude Haiku 4.5',      hint: 'Fast',        provider: 'anthropic'                          },
  { id: 'claude-3-5-sonnet-20241022',    label: 'Claude 3.5 Sonnet',     hint: 'Legacy',      provider: 'anthropic'                          },
  { id: 'gpt-4o',                        label: 'GPT-4o',                hint: 'Balanced',    provider: 'openai',    badge: 'recommended'    },
  { id: 'gpt-4o-mini',                   label: 'GPT-4o Mini',           hint: 'Fast',        provider: 'openai',    badge: 'best-value'     },
  { id: 'gpt-4.1',                       label: 'GPT-4.1',               hint: 'Long ctx',    provider: 'openai'                             },
  { id: 'o4-mini',                       label: 'o4 Mini',               hint: 'Reasoning',   provider: 'openai',    badge: 'best-reasoning' },
  { id: 'o3',                            label: 'o3',                    hint: 'Reasoning',   provider: 'openai'                             },
  { id: 'grok-3',                        label: 'Grok 3',                hint: 'Powerful',    provider: 'xai',       badge: 'recommended'    },
  { id: 'grok-3-mini',                   label: 'Grok 3 Mini',           hint: 'Reasoning',   provider: 'xai',       badge: 'best-value'     },
  { id: 'grok-2-1212',                   label: 'Grok 2',                hint: 'Balanced',    provider: 'xai'                                },
  { id: 'grok-2-vision-1212',            label: 'Grok 2 Vision',         hint: 'Vision',      provider: 'xai'                                },
  { id: 'llama-3.3-70b-versatile',       label: 'Llama 3.3 70B',         hint: 'Fast',        provider: 'groq',      badge: 'recommended'    },
  { id: 'llama-3.1-8b-instant',          label: 'Llama 3.1 8B',          hint: 'Fastest',     provider: 'groq',      badge: 'fastest'        },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B',       hint: 'Reasoning',   provider: 'groq',      badge: 'best-reasoning' },
  { id: 'qwen-qwq-32b',                  label: 'Qwen QwQ 32B',          hint: 'Reasoning',   provider: 'groq'                               },
  { id: 'mixtral-8x7b-32768',            label: 'Mixtral 8x7B',          hint: 'Balanced',    provider: 'groq'                               },
  { id: 'gemini-2.5-pro-preview-05-06',  label: 'Gemini 2.5 Pro',        hint: 'Powerful',    provider: 'google',    badge: 'most-capable'   },
  { id: 'gemini-2.0-flash',              label: 'Gemini 2.0 Flash',      hint: 'Fast',        provider: 'google',    badge: 'recommended'    },
  { id: 'gemini-2.0-flash-lite',         label: 'Gemini 2.0 Flash Lite', hint: 'Cheapest',    provider: 'google',    badge: 'best-value'     },
  { id: 'llama3.2',                      label: 'Llama 3.2',             hint: 'Local',       provider: 'ollama'                             },
  { id: 'qwen2.5',                       label: 'Qwen 2.5',              hint: 'Local',       provider: 'ollama',    badge: 'recommended'    },
  { id: 'deepseek-r1',                   label: 'DeepSeek R1',           hint: 'Local',       provider: 'ollama'                             },
  { id: 'mistral',                       label: 'Mistral 7B',            hint: 'Local',       provider: 'ollama'                             },
];

const MODEL_PROVIDERS = Array.from(new Set(MODEL_LIST.map((m) => m.provider)));
const MODELS_BY_PROVIDER = Object.fromEntries(
  MODEL_PROVIDERS.map((p) => [p, MODEL_LIST.filter((m) => m.provider === p)]),
);

const TOOL_LABELS: Record<string, string> = {
  check_workspace_secrets: 'Check workspace secrets',
  list_pods:               'List pods',
  list_workflows:          'List workflows',
  create_workflow:         'Create workflow',
  run_workflow:            'Run workflow',
  schedule_workflow:       'Schedule workflow',
  deploy_workflow:         'Deploy workflow',
  search_knowledge:        'Search knowledge base',
};

/* ─── Slash commands ─────────────────────────────────────────────────────── */
const SLASH_COMMANDS = [
  { cmd: '/run',       icon: FlowCircleIcon,      description: 'Run a workflow',                 template: 'Run the workflow '                          },
  { cmd: '/create',    icon: Add01Icon,            description: 'Create a new workflow',          template: 'Create a workflow that '                    },
  { cmd: '/deploy',    icon: CloudUploadIcon,      description: 'Deploy a workflow',              template: 'Deploy the workflow named '                 },
  { cmd: '/schedule',  icon: Calendar01Icon,       description: 'Schedule a workflow',            template: 'Schedule the workflow to run every '        },
  { cmd: '/search',    icon: Search01Icon,         description: 'Search the knowledge base',      template: 'Search for '                                },
  { cmd: '/list',      icon: WorkflowSquare01Icon, description: 'List all workflows',             template: 'List all workflows in this pod'             },
  { cmd: '/connect',   icon: LinkSquare01Icon,     description: 'Check external connectors',      template: 'Show me my connected external integrations' },
  { cmd: '/status',    icon: FlowIcon,             description: 'Check execution status',         template: 'What is the status of recent executions?'  },
  { cmd: '/memory',    icon: AiBrain01Icon,        description: 'Access memory & knowledge',      template: 'What do you know about '                   },
  { cmd: '/debug',     icon: Settings01Icon,       description: 'Debug a failed execution',       template: 'Why did my last execution fail?'            },
  { cmd: '/summarize', icon: ArrowDown01Icon,      description: 'Summarize recent activity',      template: 'Summarize what happened in this pod today' },
  { cmd: '/help',      icon: HelpCircleIcon,       description: 'Show all available commands',    template: 'What can you help me with?'                },
];

const PRESETS = [
  { icon: MailSend01Icon,       label: 'Gmail to Slack',       prompt: 'Build a workflow that monitors my Gmail for important emails and posts them to a Slack channel' },
  { icon: ReloadIcon,           label: 'Daily sync & report',  prompt: 'Create a workflow that runs every morning to sync data and send me a summary report' },
  { icon: SourceCodeSquareIcon, label: 'GitHub issue tracker', prompt: 'Set up automated GitHub issue tracking with Slack notifications when issues are opened or assigned' },
  { icon: Search01Icon,         label: 'Check integrations',   prompt: 'Check what API keys and integrations I have configured in this workspace' },
  { icon: UserGroupIcon,        label: 'CRM automation',       prompt: 'Build a self-healing CRM that syncs and enriches customer data from my connected tools' },
  { icon: Calendar01Icon,       label: 'Morning briefing',     prompt: 'Create a workflow that sends me a daily morning briefing at 9am with key updates' },
];

const TICKER_PROMPTS = [
  'Ask anything, or type / for commands…',
  '/run — trigger a workflow instantly…',
  '/create — build a new automation…',
  '/schedule — set up a recurring job…',
  '/search — query your knowledge base…',
  '/connect — check external integrations…',
];

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ─── ThinkingSteps ──────────────────────────────────────────────────────── */
function ThinkingSteps({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [open, setOpen] = useState(false);
  if (toolCalls.length === 0) return null;

  const allDone = toolCalls.every((tc) => tc.result !== undefined);
  const activeName = !allDone ? (toolCalls.find((tc) => tc.result === undefined)?.name ?? '') : '';

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors group"
      >
        {allDone ? (
          <span className="flex size-3 items-center justify-center rounded-full bg-muted text-[8px] text-muted-foreground">✓</span>
        ) : (
          <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin text-muted-foreground/60 shrink-0" />
        )}
        <span className="italic">
          {allDone
            ? `${toolCalls.length} step${toolCalls.length !== 1 ? 's' : ''} taken`
            : (TOOL_LABELS[activeName] ? `${TOOL_LABELS[activeName]}…` : 'Working…')}
        </span>
        <span className="text-[9px] text-muted-foreground/40">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-1 pl-4 border-l border-border/50">
          {toolCalls.map((tc, i) => (
            <ThinkingStepRow key={tc.id} tc={tc} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingStepRow({ tc, index }: { tc: ToolCall; index: number }) {
  const [open, setOpen] = useState(false);
  const done = tc.result !== undefined;
  const hasDetails = Object.keys(tc.input).length > 0 || done;

  return (
    <div className="text-[11px]">
      <button
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`flex w-full items-center gap-1.5 py-0.5 text-left ${hasDetails ? 'cursor-pointer hover:text-muted-foreground' : 'cursor-default'} text-muted-foreground/60 transition-colors`}
      >
        <span className="shrink-0 w-3.5 text-center text-[9px] text-muted-foreground/40">{index}.</span>
        {done
          ? <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[7px] text-muted-foreground">✓</span>
          : <HugeiconsIcon icon={Loading01Icon} className="size-2.5 shrink-0 animate-spin text-muted-foreground/40" />
        }
        <span className="italic">{TOOL_LABELS[tc.name] ?? tc.name}</span>
        {!done && <span className="text-[9px] text-muted-foreground/40">running…</span>}
        {hasDetails && (
          <span className="ml-auto text-[9px] text-muted-foreground/30">{open ? '▲' : '▼'}</span>
        )}
      </button>

      {open && hasDetails && (
        <div className="ml-5 mt-1 mb-1 space-y-1.5 rounded-md border border-border/40 bg-muted/10 px-2.5 py-2">
          {Object.keys(tc.input).length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Input</p>
              <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap break-all">{JSON.stringify(tc.input, null, 2)}</pre>
            </div>
          )}
          {done && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Result</p>
              <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap break-all">{JSON.stringify(tc.result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── WorkflowArtifactCard ───────────────────────────────────────────────── */
function WorkflowArtifactCard({ wf }: { wf: CreatedWorkflow }) {
  const href = wf.podId ? `/pods/${wf.podId}/workflows/${wf.id}` : null;
  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Workflow created</p>
          <p className="text-sm font-semibold truncate mt-0.5">{wf.name}</p>
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Open
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Markdown ───────────────────────────────────────────────────────────── */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith('```')) { codeLines.push(lines[i] ?? ''); i++; }
      elements.push(<pre key={i} className="my-2 overflow-x-auto rounded-lg bg-muted px-4 py-3 text-xs font-mono border border-border text-foreground">{codeLines.join('\n')}</pre>);
      i++; continue;
    }
    const h3 = line.match(/^###\s+(.*)/); const h2 = line.match(/^##\s+(.*)/); const h1 = line.match(/^#\s+(.*)/);
    if (h1) { elements.push(<p key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{h1[1]}</p>); i++; continue; }
    if (h2) { elements.push(<p key={i} className="mt-3 mb-1 text-sm font-bold text-foreground">{h2[1]}</p>); i++; continue; }
    if (h3) { elements.push(<p key={i} className="mt-2 mb-0.5 text-sm font-semibold text-foreground">{h3[1]}</p>); i++; continue; }
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) { elements.push(<li key={i} className="ml-4 text-sm list-disc marker:text-muted-foreground"><InlineText text={bullet[1] ?? ''} /></li>); i++; continue; }
    const num = line.match(/^\d+\.\s+(.*)/);
    if (num) { elements.push(<li key={i} className="ml-4 text-sm list-decimal marker:text-muted-foreground"><InlineText text={num[1] ?? ''} /></li>); i++; continue; }
    if (line.trim()) elements.push(<p key={i} className="text-sm leading-relaxed"><InlineText text={line} /></p>);
    else if (elements.length > 0) elements.push(<div key={i} className="h-1.5" />);
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

/* ─── MessageBubble ──────────────────────────────────────────────────────── */
function MessageBubble({ msg, feedbackVote, onFeedback }: {
  msg: Message;
  feedbackVote?: 'up' | 'down';
  onFeedback?: (v: 'up' | 'down') => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const modelLabel = MODEL_LIST.find((m) => m.id === msg.model)?.label;

  const createdWorkflows: CreatedWorkflow[] = (msg.toolCalls ?? [])
    .filter((tc) => tc.name === 'create_workflow' && tc.result != null)
    .flatMap((tc) => {
      const r = tc.result as { id?: string; name?: string; podId?: string } | null;
      if (r?.id && r?.name) return [{ id: r.id, name: r.name, podId: r.podId }];
      return [];
    });

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-1.5">
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {msg.attachments.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                  <HugeiconsIcon icon={a.type === 'workflow' ? WorkflowSquare01Icon : Attachment01Icon} className="size-3" />
                  {a.name}
                </span>
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-tr-sm bg-muted px-4 py-2.5 text-sm text-foreground leading-relaxed">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 group">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm mt-1">
        <HugeiconsIcon icon={AiMagicIcon} className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <ThinkingSteps toolCalls={msg.toolCalls ?? []} />
        {msg.content && (
          <div>
            <div className="text-foreground leading-relaxed">
              <MarkdownText text={msg.content} />
            </div>
            {!msg.streaming && (
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => void copy()} className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <HugeiconsIcon icon={copied ? CheckmarkCircle01Icon : Copy01Icon} className="size-3.5" />
                </button>
                {onFeedback && (
                  <>
                    <button onClick={() => onFeedback('up')} className={`rounded-md p-1.5 transition-colors ${feedbackVote === 'up' ? 'text-green-600' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <HugeiconsIcon icon={ThumbsUpIcon} className="size-3.5" />
                    </button>
                    <button onClick={() => onFeedback('down')} className={`rounded-md p-1.5 transition-colors ${feedbackVote === 'down' ? 'text-destructive' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <HugeiconsIcon icon={ThumbsDownIcon} className="size-3.5" />
                    </button>
                  </>
                )}
                {modelLabel && (
                  <>
                    <div className="h-3 w-px bg-border mx-1" />
                    <span className="text-[10px] text-muted-foreground/60 px-1">{modelLabel}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {createdWorkflows.map((wf) => (
          <WorkflowArtifactCard key={wf.id} wf={wf} />
        ))}
        {msg.streaming && !msg.content && (
          <div className="flex gap-1 py-2">
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── History Sidebar ────────────────────────────────────────────────────── */
function HistorySidebar({ sessions, currentId, onLoad, onNew, onDelete }: {
  sessions: Session[];
  currentId: string;
  onLoad: (s: Session) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const grouped: { label: string; items: Session[] }[] = [];
  const now = Date.now();
  const today: Session[] = [], week: Session[] = [], older: Session[] = [];
  for (const s of sessions) {
    const age = now - s.createdAt;
    if (age < 86_400_000) today.push(s);
    else if (age < 7 * 86_400_000) week.push(s);
    else older.push(s);
  }
  if (today.length) grouped.push({ label: 'Today', items: today });
  if (week.length)  grouped.push({ label: 'This week', items: week });
  if (older.length) grouped.push({ label: 'Older', items: older });

  return (
    <div className="flex h-full flex-col bg-muted/30 border-r border-border">
      <div className="p-3 border-b border-border shrink-0">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5 text-muted-foreground" />
          New conversation
        </button>
      </div>
      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">No past conversations yet.</p>
        ) : (
          <div className="py-2">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
                {group.items.map((s) => (
                  <div key={s.id} className={`group relative flex items-center rounded-md mx-2 mb-0.5 ${s.id === currentId ? 'bg-muted' : 'hover:bg-muted/60'} transition-colors`}>
                    <button
                      onClick={() => onLoad(s)}
                      className="flex-1 min-w-0 px-2 py-2 text-left"
                    >
                      <p className={`text-xs font-medium truncate ${s.id === currentId ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {s.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(s.createdAt)}</p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                      className="shrink-0 mr-1 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ─── Attach menu ────────────────────────────────────────────────────────── */
const CONNECTOR_TYPES = [
  { id: 'slack',  label: 'Slack',  icon: Message01Icon        },
  { id: 'github', label: 'GitHub', icon: SourceCodeSquareIcon },
  { id: 'gmail',  label: 'Gmail',  icon: MailSend01Icon       },
  { id: 'notion', label: 'Notion', icon: StickyNote01Icon     },
];

function AttachMenu({
  disabled, workflows, workflowsLoading, attachments,
  onFile, onWorkflow, onConnector, onMemory,
}: {
  disabled: boolean;
  workflows: { id: string; name: string }[];
  workflowsLoading: boolean;
  attachments: Attachment[];
  onFile: () => void;
  onWorkflow: (wf: { id: string; name: string }) => void;
  onConnector: (id: string, label: string) => void;
  onMemory: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          title="Attach context"
          className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        {/* Upload file */}
        <DropdownMenuItem onSelect={onFile}>
          <HugeiconsIcon icon={Attachment01Icon} className="size-3.5 text-muted-foreground" />
          Add photos &amp; files
        </DropdownMenuItem>

        {/* Workflows sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 text-muted-foreground" />
            Workflows
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {workflowsLoading ? (
              <DropdownMenuItem disabled>
                <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin" />
                Loading…
              </DropdownMenuItem>
            ) : workflows.length === 0 ? (
              <DropdownMenuItem disabled>No workflows in this pod</DropdownMenuItem>
            ) : (
              <ScrollArea className="max-h-48">
                {workflows.map((wf) => (
                  <DropdownMenuItem key={wf.id} onSelect={() => onWorkflow(wf)}>
                    <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{wf.name}</span>
                    {attachments.some((a) => a.workflowId === wf.id) && (
                      <span className="text-[10px] text-primary shrink-0">attached</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Knowledge & memory */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={AiBrain01Icon} className="size-3.5 text-muted-foreground" />
            Memory &amp; knowledge
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem onSelect={onMemory}>
              <HugeiconsIcon icon={AiBrain01Icon} className="size-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Knowledge base</p>
                <p className="text-muted-foreground text-[11px]">Semantic search over docs</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMemory}>
              <HugeiconsIcon icon={Database01Icon} className="size-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Session memory</p>
                <p className="text-muted-foreground text-[11px]">Full conversation context</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* External connectors */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={LinkSquare01Icon} className="size-3.5 text-muted-foreground" />
            External connectors
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {CONNECTOR_TYPES.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => onConnector(c.id, c.label)}>
                <HugeiconsIcon icon={c.icon} className="size-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1">{c.label}</span>
                {attachments.some((a) => a.connectorId === c.id) && (
                  <span className="text-[10px] text-primary">on</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/connections">
                <HugeiconsIcon icon={Settings01Icon} className="size-3.5" />
                Manage connections
              </Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Slash commands hint */}
        <DropdownMenuItem disabled>
          <span className="text-xs font-mono text-muted-foreground font-bold">/</span>
          <span>Type <kbd className="font-mono text-[10px] bg-muted px-1 rounded">/</kbd> for commands</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
function TasksPageInner() {
  const { getToken } = useAuth();
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
  const [model, setModel] = useState(MODEL_LIST[0]!.id);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  /* slash command state */
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);

  /* animated placeholder */
  const [tickerIdx, setTickerIdx] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const slashScrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const hasMessages = messages.length > 0;

  const filteredSlash = SLASH_COMMANDS.filter((c) =>
    c.cmd.slice(1).startsWith(slashQuery.toLowerCase()),
  );

  useEffect(() => {
    if (!activeWorkspace) return;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const rows = await api.get<Array<{ id: string; threadId: string; title: string; messages: unknown[]; createdAt: string }>>(`/workspaces/${activeWorkspace.id}/agent/sessions`);
        setSessions(rows.map((r) => ({
          id: r.threadId,
          dbId: r.id,
          title: r.title,
          createdAt: new Date(r.createdAt).getTime(),
          messages: (r.messages ?? []) as Message[],
        })));
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  // Auto-load session from URL ?s=<threadId> once sessions are available
  useEffect(() => {
    const sid = searchParams.get('s');
    if (!sid || sessions.length === 0) return;
    const match = sessions.find((s) => s.id === sid);
    if (match && match.id !== sessionId) {
      abortRef.current?.abort();
      setMessages((match.messages ?? []).map((m) => ({ ...m, streaming: false })));
      setSessionId(match.id);
      setIsStreaming(false);
      setAttachments([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, searchParams]);

  useEffect(() => { if (hasMessages) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, hasMessages]);
  useEffect(() => {
    if (!slashOpen) return;
    const active = slashScrollRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [slashIdx, slashOpen]);

  /* Cycle ticker prompts when idle */
  useEffect(() => {
    if (input || isStreaming || isFocused) return;
    const t = setInterval(() => {
      setTickerVisible(false);
      setTimeout(() => {
        setTickerIdx((i) => (i + 1) % TICKER_PROMPTS.length);
        setTickerVisible(true);
      }, 220);
    }, 3200);
    return () => clearInterval(t);
  }, [input, isStreaming, isFocused]);

  /* Load workflows when pod changes */
  useEffect(() => {
    if (activePod && activeWorkspace) void fetchWorkflows();
  }, [activePod?.id, activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function resizeTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  async function upsertSession(msgs: Message[], sid: string, firstUserMsg: string) {
    const title = firstUserMsg.slice(0, 60);
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sid);
      const next: Session = { id: sid, dbId: existing?.dbId, title, createdAt: existing?.createdAt ?? Date.now(), messages: msgs };
      return [next, ...prev.filter((s) => s.id !== sid)];
    });
    if (!activeWorkspace) return;
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const saved = await api.post<{ id: string; threadId: string }>(
        `/workspaces/${activeWorkspace.id}/agent/sessions`,
        { threadId: sid, title, messages: msgs },
      );
      setSessions((prev) => prev.map((s) => s.id === sid ? { ...s, dbId: saved.id } : s));
    } catch { /* ignore */ }
  }

  function startNewChat() {
    abortRef.current?.abort();
    setMessages([]); setInput(''); setAttachments([]);
    setSessionId(`s-${Date.now()}`); setIsStreaming(false);
    router.push('/tasks', { scroll: false });
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function loadSession(s: Session) {
    abortRef.current?.abort();
    setMessages((s.messages ?? []).map((m) => ({ ...m, streaming: false })));
    setSessionId(s.id); setIsStreaming(false); setAttachments([]);
    router.push(`/tasks?s=${encodeURIComponent(s.id)}`, { scroll: false });
  }

  async function deleteSession(id: string) {
    const session = sessions.find((s) => s.id === id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === sessionId) startNewChat();
    if (session?.dbId && activeWorkspace) {
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        await api.delete(`/workspaces/${activeWorkspace.id}/agent/sessions/${session.dbId}`);
      } catch { /* ignore */ }
    }
  }

  function getHistory(currentMessages: Message[]) {
    return currentMessages.filter((m) => m.content).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  /* ── Slash commands ──────────────────────────────────────────────────── */
  function handleInputChange(val: string) {
    setInput(val);
    resizeTextarea();
    const match = val.match(/^\/(\w*)$/);
    if (match) {
      setSlashQuery(match[1] ?? '');
      setSlashIdx(0);
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  }

  function selectSlashCommand(cmd: typeof SLASH_COMMANDS[number]) {
    setInput(cmd.cmd + ' ');
    setSlashOpen(false);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      resizeTextarea();
    }, 10);
  }

  /* ── File attachment ─────────────────────────────────────────────────── */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result : undefined;
        setAttachments((prev) => [...prev, {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name, type: 'file', content, fileType: file.type,
        }]);
      };
      if (file.type.startsWith('text/') || file.type === 'application/json') {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  }

  /* ── Workflow/connector attachment ───────────────────────────────────── */
  async function fetchWorkflows() {
    if (!activePod || !activeWorkspace) return;
    setWorkflowsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<{ id: string; name: string }[]>(
        `/workspaces/${activeWorkspace.id}/pods/${activePod.id}/workflows`,
      );
      setWorkflows(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setWorkflowsLoading(false);
    }
  }

  function attachWorkflow(wf: { id: string; name: string }) {
    if (attachments.some((a) => a.workflowId === wf.id)) return;
    setAttachments((prev) => [...prev, {
      id: `w-${wf.id}`, name: wf.name, type: 'workflow',
      workflowId: wf.id, content: `Workflow: ${wf.name} (ID: ${wf.id})`,
    }]);
  }

  function attachConnector(id: string, label: string) {
    if (attachments.some((a) => a.connectorId === id)) return;
    setAttachments((prev) => [...prev, {
      id: `c-${id}`, name: label, type: 'connector', connectorId: id,
      content: `External connector context: ${label}`,
    }]);
  }

  function attachMemory() {
    const already = attachments.some((a) => a.id === 'memory');
    if (already) return;
    setAttachments((prev) => [...prev, {
      id: 'memory', name: 'Knowledge base', type: 'memory',
      content: 'Include relevant knowledge base context in your response.',
    }]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  /* ── Mic (Web Speech API) ────────────────────────────────────────────── */
  function toggleMic() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRec = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRec) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const recognition = new SpeechRec();
    recognitionRef.current = recognition;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.onresult = (event: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) handleInputChange(input ? `${input} ${transcript}` : transcript);
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.onend = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    recognition.start();
    setIsListening(true);
  }

  /* ── Feedback ────────────────────────────────────────────────────────── */
  function handleFeedback(messageId: string, vote: 'up' | 'down') {
    setFeedback((prev) => {
      if (prev[messageId] === vote) {
        const next = { ...prev };
        delete next[messageId];
        return next;
      }
      return { ...prev, [messageId]: vote };
    });
  }

  /* ── Build content with attachments ─────────────────────────────────── */
  function buildContent(text: string, atts: Attachment[]): string {
    if (!atts.length) return text;
    const parts = [text];
    for (const a of atts) {
      if (a.type === 'workflow') {
        parts.push(`\n\n[Attached workflow context: ${a.name} (ID: ${a.workflowId})]`);
      } else if (a.type === 'connector') {
        parts.push(`\n\n[External connector attached: ${a.name}]`);
      } else if (a.type === 'memory') {
        parts.push(`\n\n[Include relevant knowledge base context]`);
      } else if (a.fileType?.startsWith('text/') || a.fileType === 'application/json') {
        parts.push(`\n\n[File: ${a.name}]\n\`\`\`\n${a.content ?? ''}\n\`\`\``);
      } else {
        parts.push(`\n\n[Attached file: ${a.name}]`);
      }
    }
    return parts.join('');
  }

  /* ── SSE event handler ───────────────────────────────────────────────── */
  const handleEvent = useCallback((evt: SSEEvent, assistantId: string) => {
    if (evt.type === 'text_delta' && evt.delta) {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + evt.delta! } : m));
    } else if (evt.type === 'step_start' && evt.id && evt.name) {
      // Tool starting — add a placeholder immediately so UI shows progress before input arrives
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, toolCalls: [...(m.toolCalls ?? []).filter((tc) => tc.id !== evt.id!), { id: evt.id!, name: evt.name!, input: {} }] }
          : m,
      ));
    } else if (evt.type === 'tool_call' && evt.id && evt.name) {
      // Full tool call with input — update the placeholder created by step_start
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, toolCalls: (m.toolCalls ?? []).map((tc) => tc.id === evt.id ? { ...tc, input: evt.input ?? {} } : tc) }
          : m,
      ));
    } else if (evt.type === 'tool_result' && evt.id) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, toolCalls: (m.toolCalls ?? []).map((tc) => tc.id === evt.id ? { ...tc, result: evt.result } : tc) }
          : m,
      ));
    }
  }, []);

  /* ── Send ────────────────────────────────────────────────────────────── */
  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || isStreaming || !activeWorkspace) return;

    const currentAttachments = [...attachments];
    const fullContent = buildContent(text, currentAttachments);

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, attachments: currentAttachments };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', toolCalls: [], streaming: true, model };

    setAttachments([]);
    setMessages((prev) => {
      const next = [...prev, userMsg, assistantMsg];
      const firstMsg = prev.find((m) => m.role === 'user')?.content ?? text;
      void upsertSession(next, sessionId, firstMsg);
      return next;
    });
    setInput('');
    setSlashOpen(false);
    resizeTextarea();
    setIsStreaming(true);

    const token = await getToken();
    if (!token) { setIsStreaming(false); return; }

    abortRef.current = new AbortController();

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
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try { handleEvent(JSON.parse(line.slice(6)) as SSEEvent, assistantId); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: m.content || '*Something went wrong. Please try again.*', streaming: false } : m,
      ));
    } finally {
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id !== assistantId) return m;
          // Resolve any tool calls that never got a result (stream died mid-call)
          const toolCalls = (m.toolCalls ?? []).map((tc) =>
            tc.result !== undefined ? tc : { ...tc, result: { error: 'Stream ended before result was received' } },
          );
          return { ...m, streaming: false, toolCalls };
        });
        const firstMsg = prev.find((m) => m.role === 'user')?.content ?? '';
        void upsertSession(next, sessionId, firstMsg);
        return next;
      });
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen && filteredSlash.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % filteredSlash.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + filteredSlash.length) % filteredSlash.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredSlash[slashIdx];
        if (cmd) selectSlashCommand(cmd);
        return;
      }
      if (e.key === 'Escape') {
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  function stop() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m));
  }

  const currentModel = MODEL_LIST.find((m) => m.id === model) ?? MODEL_LIST[0]!;

  /* ── Input box ───────────────────────────────────────────────────────── */
  const inputBox = (
    <div className="rounded-2xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring/50 transition-all overflow-hidden">
      {/* Slash command menu */}
      {slashOpen && filteredSlash.length > 0 && (
        <div className="border-b border-border/50 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
          <div ref={slashScrollRef} className="no-scrollbar overflow-y-auto" style={{ maxHeight: 176 }}>
            <div className="px-1 py-1">
              {filteredSlash.map((cmd, idx) => (
                <button
                  key={cmd.cmd}
                  data-active={slashIdx === idx}
                  onClick={() => selectSlashCommand(cmd)}
                  className={`group relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-left outline-none select-none transition-colors ${slashIdx === idx ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'}`}
                >
                  <HugeiconsIcon icon={cmd.icon} className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs font-semibold text-primary w-[5rem] shrink-0">{cmd.cmd}</span>
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

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={handleFileSelect} />

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
          {attachments.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
              <HugeiconsIcon icon={a.type === 'workflow' ? WorkflowSquare01Icon : a.type === 'memory' ? Database01Icon : Attachment01Icon} className="size-3 text-muted-foreground shrink-0" />
              <span className="max-w-[120px] truncate">{a.name}</span>
              <button onClick={() => removeAttachment(a.id)} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea row */}
      <div className="flex items-end gap-2 px-3 py-3">
        <div className="relative flex-1 min-h-[1.5rem]">
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
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none min-h-[1.5rem] max-h-40 leading-relaxed"
          />
          {/* Animated ticker placeholder */}
          {!input && (
            <p
              aria-hidden
              className={`pointer-events-none absolute inset-0 text-sm leading-relaxed transition-all duration-200 select-none ${
                tickerVisible && !isFocused && !isStreaming
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-1'
              } ${isStreaming ? 'text-muted-foreground/40' : 'text-muted-foreground/50'}`}
            >
              {isStreaming ? 'Linea Agent is thinking…' : TICKER_PROMPTS[tickerIdx]}
            </p>
          )}
        </div>

        {/* Right side: mic + send/stop */}
        <div className="flex items-center gap-1.5 shrink-0 self-end">
          <button
            onClick={toggleMic}
            disabled={isStreaming}
            title={isListening ? 'Stop listening' : 'Voice input'}
            className={`flex size-7 items-center justify-center rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-500/10 text-red-500 animate-pulse'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <HugeiconsIcon icon={Mic01Icon} className="size-4" />
          </button>
          {isStreaming ? (
            <button
              onClick={stop}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-colors"
              title="Stop"
            >
              <span className="size-3 rounded-sm bg-foreground" />
            </button>
          ) : (
            <button
              onClick={() => void send()}
              disabled={!input.trim() || !activeWorkspace}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background hover:opacity-80 disabled:opacity-30 transition-opacity"
              title="Send (Enter)"
            >
              <HugeiconsIcon icon={PlaneIcon} className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
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

        {/* Model selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <span className="font-medium">{currentModel.label}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-52 max-h-[360px] overflow-y-auto">
            {MODEL_PROVIDERS.map((provider, pi) => (
              <div key={provider}>
                {pi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-normal px-2 py-1">
                  {PROVIDER_LABELS[provider] ?? provider}
                </DropdownMenuLabel>
                {(MODELS_BY_PROVIDER[provider] ?? []).map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <span className="truncate flex-1 text-xs">{m.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.badge && (
                        <span className="text-[9px] rounded px-1 py-0.5 bg-primary/10 text-primary font-medium hidden sm:block">
                          {m.badge.replace(/-/g, ' ')}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{m.hint}</span>
                      {model === m.id && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  /* ── Preset chips ────────────────────────────────────────────────────── */
  const presetChips = (
    <div className="flex flex-wrap justify-center gap-2 mt-3">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => void send(p.prompt)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-all"
        >
          <HugeiconsIcon icon={p.icon} className="size-3.5 shrink-0" />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );

  if (!activeWorkspace) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center -m-6">
        <p className="text-sm text-muted-foreground">Select a workspace to use Linea Agent.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 bg-background overflow-hidden">
      {/* ── History sidebar ─────────────────────────────────────────── */}
      <div
        className="shrink-0 overflow-hidden transition-all duration-200"
        style={{ width: sidebarOpen ? 240 : 0 }}
      >
        {sidebarOpen && (
          <HistorySidebar
            sessions={sessions}
            currentId={sessionId}
            onLoad={(s) => { loadSession(s); }}
            onNew={startNewChat}
            onDelete={(id) => void deleteSession(id)}
          />
        )}
      </div>

      {/* ── Main chat area ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant={sidebarOpen ? 'secondary' : 'ghost'}
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle conversation history"
            >
              <HugeiconsIcon icon={sidebarOpen ? ArrowLeft01Icon : ArrowRight01Icon} className="size-4" />
            </Button>
            {hasMessages && (
              <Button size="icon-sm" variant="ghost" onClick={startNewChat} title="New conversation">
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600">
              <HugeiconsIcon icon={AiMagicIcon} className="size-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">Linea Agent</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon-sm" variant="ghost"
              title="Help & docs"
              onClick={() => window.open('https://docs.linea.build', '_blank')}
            >
              <HugeiconsIcon icon={HelpCircleIcon} className="size-4" />
            </Button>
          </div>
        </div>

        {!hasMessages ? (
          /* Idle: centered */
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12 overflow-y-auto">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
                <HugeiconsIcon icon={AiMagicIcon} className="size-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">What can I automate for you?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Build workflows, run tasks, check integrations with AI</p>
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
                    onFeedback={msg.role === 'assistant' ? (v) => handleFeedback(msg.id, v) : undefined}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="shrink-0 px-6 pb-6">
              <div className="mx-auto max-w-2xl">
                {inputBox}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksPageInner />
    </Suspense>
  );
}
