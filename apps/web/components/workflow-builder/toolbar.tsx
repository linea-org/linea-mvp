'use client';

import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, FloppyDiskIcon, PlayIcon, Loading01Icon, SparklesIcon, WebhookIcon, ClockIcon, CloudUploadIcon, CheckmarkCircle01Icon, Download04Icon, Upload04Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Separator } from '@linea/ui/components/separator';

export interface ValidationState {
  level: 'error' | 'warning' | 'success';
  issues: string[];
}

interface ToolbarProps {
  workflowName: string;
  isSaving: boolean;
  isRunning: boolean;
  isGenerating: boolean;
  runStatus: { id: string; status: string } | null;
  validationState: ValidationState;
  webhookOpen: boolean;
  historyOpen: boolean;
  isDeploying: boolean;
  isDeployed: boolean;
  onSave: () => void;
  onRun: () => void;
  onDeploy: () => void;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onGenerate: () => void;
  onWebhook: () => void;
  onHistory: () => void;
  onExport: () => void;
  onImport: () => void;
}

/* ------------------------------------------------------------------ */
/*  Validation badge                                                    */
/* ------------------------------------------------------------------ */
function ValidationBadge({ state }: { state: ValidationState }) {
  const [open, setOpen] = useState(false);
  const { level, issues } = state;

  const cfg = {
    error:   { dot: 'bg-red-500',   ring: 'animate-pulse', text: 'text-red-600 dark:text-red-400',   popoverText: 'text-red-600 dark:text-red-400',   heading: 'Errors',   label: issues.length === 1 ? '1 error' : `${issues.length} errors` },
    warning: { dot: 'bg-amber-500', ring: '',              text: 'text-amber-600 dark:text-amber-400', popoverText: 'text-amber-600 dark:text-amber-400', heading: 'Warnings', label: issues.length === 1 ? '1 warning' : `${issues.length} warnings` },
    success: { dot: 'bg-green-500', ring: '',              text: 'text-green-600 dark:text-green-400', popoverText: '',                                  heading: '',         label: 'Ready' },
  }[level];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={`flex cursor-default items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
        <span className={`size-1.5 rounded-full ${cfg.dot} ${cfg.ring}`} />
        {cfg.label}
      </span>

      {open && issues.length > 0 && (
        <div className="absolute top-full right-0 z-50 mt-2 w-60 rounded-lg border bg-popover p-2.5 shadow-lg">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {cfg.heading}
          </p>
          <ul className="space-y-1.5">
            {issues.map((issue, i) => (
              <li key={i} className={`flex items-start gap-1.5 text-xs ${cfg.popoverText}`}>
                <span className="mt-px shrink-0 leading-none">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-muted-foreground',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-destructive',
  cancelled: 'text-muted-foreground',
  suspended: 'text-yellow-500',
};

export function Toolbar({ workflowName, isSaving, isRunning, isGenerating, runStatus, validationState, webhookOpen, historyOpen, isDeploying, isDeployed, onSave, onRun, onDeploy, onBack, onNameChange, onGenerate, onWebhook, onHistory, onExport, onImport }: ToolbarProps) {
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(workflowName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalName(workflowName); }, [workflowName]);

  useEffect(() => {
    if (editingName) inputRef.current?.focus();
  }, [editingName]);

  function commitName() {
    const trimmed = localName.trim() || workflowName;
    setLocalName(trimmed);
    onNameChange(trimmed);
    setEditingName(false);
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3 z-10">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={onBack} title="Back to workflows">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        {editingName ? (
          <Input
            ref={inputRef}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setLocalName(workflowName); setEditingName(false); }
            }}
            className="h-6 w-52 text-sm font-semibold"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            title="Click to rename"
            className="max-w-64 truncate text-sm font-semibold text-foreground hover:text-muted-foreground cursor-text"
          >
            {workflowName}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {runStatus && (
          <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_COLOR[runStatus.status] ?? 'text-muted-foreground'}`}>
            {runStatus.status === 'running' && (
              <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />
            )}
            {runStatus.status}
          </span>
        )}
        {isGenerating && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-violet-500">
            <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />
            Generating…
          </span>
        )}

        {!runStatus && !isGenerating && (
          <>
            <ValidationBadge state={validationState} />
            <Separator orientation="vertical" className="h-4" />
          </>
        )}

        <Button
          size="icon-sm"
          variant={historyOpen ? 'secondary' : 'outline'}
          onClick={onHistory}
          title="Run history"
        >
          <HugeiconsIcon icon={ClockIcon} className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant={webhookOpen ? 'secondary' : 'outline'}
          onClick={onWebhook}
          title="Webhook trigger"
        >
          <HugeiconsIcon icon={WebhookIcon} className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={onImport} title="Import workflow JSON">
          <HugeiconsIcon icon={Upload04Icon} className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={onExport} title="Export workflow JSON">
          <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onGenerate}
          disabled={isGenerating}
          className="border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400"
        >
          <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
          Generate
        </Button>
        <Button size="sm" variant="outline" onClick={onSave} disabled={isSaving || isGenerating}>
          <HugeiconsIcon icon={isSaving ? Loading01Icon : FloppyDiskIcon} className={isSaving ? 'animate-spin' : ''} />
          Save
        </Button>
        <Button
          size="sm"
          variant={isDeployed ? 'secondary' : 'outline'}
          onClick={onDeploy}
          disabled={isDeploying || isGenerating}
          className={isDeployed ? 'text-green-700 border-green-300 dark:text-green-400' : ''}
          title="Save and deploy this workflow"
        >
          <HugeiconsIcon
            icon={isDeploying ? Loading01Icon : isDeployed ? CheckmarkCircle01Icon : CloudUploadIcon}
            className={`size-3.5 ${isDeploying ? 'animate-spin' : ''}`}
          />
          {isDeployed ? 'Deployed' : 'Deploy'}
        </Button>
        <Button size="sm" onClick={onRun} disabled={isRunning || isGenerating}>
          <HugeiconsIcon icon={isRunning ? Loading01Icon : PlayIcon} className={isRunning ? 'animate-spin' : ''} />
          Run
        </Button>
      </div>
    </div>
  );
}
