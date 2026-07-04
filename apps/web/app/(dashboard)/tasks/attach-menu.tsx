'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, Attachment01Icon, WorkflowSquare01Icon,
  AiBrain01Icon, Database01Icon, LinkSquare01Icon, Settings01Icon,
} from '@hugeicons/core-free-icons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@linea/ui/components/dropdown-menu';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { Spinner } from '@linea/ui/components/spinner';
import { CONNECTOR_TYPES } from './constants';
import type { Attachment } from './types';

export function AttachMenu({
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
        <DropdownMenuItem onSelect={onFile}>
          <HugeiconsIcon icon={Attachment01Icon} className="size-3.5 text-muted-foreground" />
          Add photos &amp; files
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 text-muted-foreground" />
            Workflows
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {workflowsLoading ? (
              <DropdownMenuItem disabled>
                <Spinner className="size-3.5" />
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

        <DropdownMenuItem disabled>
          <span className="text-xs font-mono text-muted-foreground font-bold">/</span>
          <span>Type <kbd className="font-mono text-[10px] bg-muted px-1 rounded">/</kbd> for commands</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
