'use client';

import { useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SparklesIcon,
  Cancel01Icon,
  Tick02Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Textarea } from '@linea/ui/components/textarea';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

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
  token: string;
  onEvent: (event: GenerateEvent) => void;
  onClose: () => void;
}

type Phase = 'idle' | 'generating' | 'done' | 'error';

const EXAMPLES = [
  'Fetch Hacker News top stories, summarize them with Claude, and post to a Slack channel',
  'When a GitHub issue is created, triage its priority with AI and add the right labels',
  'Take a URL as input, scrape the page content, and return a 3-bullet summary',
  'Process a customer support ticket, classify urgency, and draft a reply for human approval',
];

export function GenerateDialog({
  workspaceId,
  podId,
  workflowId,
  token,
  onEvent,
  onClose,
}: GenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [messages, setMessages] = useState<string[]>([]);
  const [nodeCount, setNodeCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  function addMessage(msg: string) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handleGenerate() {
    if (!prompt.trim() || phase === 'generating') return;

    setPhase('generating');
    setMessages([]);
    setNodeCount(0);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const resp = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: prompt.trim() }),
          signal: ac.signal,
        },
      );

      if (!resp.ok || !resp.body) {
        throw new Error(`Server error: ${resp.status}`);
      }

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
          if (!line.startsWith('data: ')) continue;
          try {
            const event: GenerateEvent = JSON.parse(line.slice(6));
            onEvent(event);

            if (event.type === 'progress' && event.message) {
              addMessage(event.message);
            } else if (event.type === 'node_added') {
              setNodeCount((n) => n + 1);
            } else if (event.type === 'complete') {
              addMessage(`Done — ${event.definition?.nodes.length ?? 0} nodes, ${event.definition?.edges.length ?? 0} edges`);
              setPhase('done');
            } else if (event.type === 'error') {
              addMessage(`Error: ${event.message}`);
              setPhase('error');
            }
          } catch {
            // malformed chunk
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        setPhase('error');
      }
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setPhase('idle');
    setMessages([]);
    setNodeCount(0);
  }

  const isGenerating = phase === 'generating';
  const isDone = phase === 'done';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={SparklesIcon} className="size-4 text-violet-500" />
          <span className="text-sm font-semibold">Generate with AI</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Describe what you want to automate
          </label>
          <Textarea
            rows={5}
            placeholder="e.g. Fetch the top 5 Hacker News stories, summarize each with Claude, and post a digest to Slack every morning"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating || isDone}
            className="resize-none text-sm"
          />
        </div>

        {/* Example prompts */}
        {phase === 'idle' && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Examples
            </p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="block w-full rounded-md border border-dashed px-3 py-2 text-left text-xs text-muted-foreground hover:border-violet-300 hover:bg-violet-50/50 hover:text-foreground transition-colors dark:hover:bg-violet-950/20"
                onClick={() => setPrompt(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Progress log */}
        {messages.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {i === messages.length - 1 && isGenerating ? (
                  <HugeiconsIcon icon={Loading03Icon} className="mt-0.5 size-3 shrink-0 animate-spin text-violet-500" />
                ) : (
                  <HugeiconsIcon icon={Tick02Icon} className="mt-0.5 size-3 shrink-0 text-green-500" />
                )}
                <span className="text-muted-foreground">{msg}</span>
              </div>
            ))}
            {isGenerating && nodeCount > 0 && (
              <p className="pl-5 text-[11px] text-violet-500 font-medium">
                {nodeCount} node{nodeCount !== 1 ? 's' : ''} placed on canvas…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 flex gap-2 justify-end">
        {isDone ? (
          <Button size="sm" onClick={onClose}>
            Start editing
          </Button>
        ) : isGenerating ? (
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={prompt.trim().length < 10}
              onClick={() => void handleGenerate()}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
              Generate
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
