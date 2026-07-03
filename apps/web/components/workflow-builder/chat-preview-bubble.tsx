'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { WorkflowSquare01Icon, Cancel01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { cn } from '@linea/ui/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from './chat-preview-panel.types';

export function ChatBubble({ msg, onApprove }: { msg: ChatMessage; onApprove?: (approved: boolean) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-1">
          {msg.simulated && (
            <div className="flex justify-end">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 border border-border/40 rounded px-1.5 py-0.5">
                Simulated
              </span>
            </div>
          )}
          <div className={`rounded-2xl rounded-tr-sm px-3 py-2 text-sm ${msg.simulated ? 'bg-muted text-foreground font-mono text-xs' : 'bg-primary text-primary-foreground'}`}>
            {msg.simulated ? msg.content.slice(0, 300) + (msg.content.length > 300 ? '…' : '') : msg.content}
          </div>
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
            className={cn(
              'rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm',
              msg.isError
                ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                : msg.suspended
                  ? 'bg-muted border border-border text-foreground'
                  : 'bg-muted text-foreground',
            )}
          >
            {msg.content ? (
              <ReactMarkdown
                components={{
                  p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  h1:     ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                  h2:     ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                  h3:     ({ children }) => <p className="font-medium mb-1">{children}</p>,
                  ul:     ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                  ol:     ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                  li:     ({ children }) => <li className="text-sm">{children}</li>,
                  code:   ({ children, className: cls }) =>
                    cls
                      ? <code className="block bg-background/60 rounded p-2 text-xs font-mono my-1 overflow-x-auto whitespace-pre">{children}</code>
                      : <code className="bg-background/60 rounded px-1 text-xs font-mono">{children}</code>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  a:      ({ href, children }) => {
                    const safe = /^https?:\/\//i.test(href ?? '') ? href : '#';
                    return <a href={safe} className="underline text-primary" target="_blank" rel="noopener noreferrer">{children}</a>;
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              <span className="text-muted-foreground italic">(empty response)</span>
            )}
            {msg.isApproval && onApprove && (
              <div className="mt-3 space-y-2">
                {msg.isToolApproval && msg.toolName && (
                  <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">
                      Agent wants to run
                    </p>
                    <p className="font-mono text-xs text-foreground/80 mb-1">{msg.toolName}</p>
                    {msg.toolSummary && (
                      <pre className="text-[11px] text-muted-foreground/70 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        {msg.toolSummary}
                      </pre>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApprove(false)}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="mr-1 size-3.5" />
                    {msg.isToolApproval ? 'Deny' : 'Reject'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onApprove(true)}
                  >
                    <HugeiconsIcon icon={Tick01Icon} className="mr-1 size-3.5" />
                    {msg.isToolApproval ? 'Allow' : 'Approve'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
