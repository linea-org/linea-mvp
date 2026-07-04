'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon, Attachment01Icon, AiMagicIcon,
  Copy01Icon, CheckmarkCircle01Icon, ThumbsUpIcon, ThumbsDownIcon,
} from '@hugeicons/core-free-icons';
import { ThinkingSteps } from './thinking-steps';
import { MarkdownText } from './markdown-text';
import { WorkflowArtifactCard } from './workflow-artifact-card';
import { useModelCatalog } from './use-model-catalog';
import type { Message, CreatedWorkflow } from './types';

export function MessageBubble({ msg, feedbackVote, onFeedback }: {
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

  const { data: modelList = [] } = useModelCatalog();
  const modelLabel = modelList.find((m) => m.id === msg.model)?.label;

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
