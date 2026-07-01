'use client';

import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  ArrowLeft01Icon, FloppyDiskIcon, PlayIcon, Loading01Icon, SparklesIcon,
  ClockIcon, CloudUploadIcon, CheckmarkCircle01Icon,
  Download04Icon, Upload04Icon, GitBranchIcon, Share01Icon,
  UndoIcon, RedoIcon, AlignSelectionIcon, AlarmClockIcon, BubbleChatIcon,
  KeyboardIcon, Cancel01Icon, TestTube01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Separator } from '@linea/ui/components/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@linea/ui/components/tooltip';
import { Kbd } from '@linea/ui/components/kbd';
import { PresenceAvatars } from './presence-avatars';

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
  deployPanelOpen: boolean;
  historyOpen: boolean;
  versionsOpen: boolean;
  shareOpen: boolean;
  commentsOpen: boolean;
  evalsOpen: boolean;
  isDeployed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  autoSave: boolean;
  token?: string;
  workspaceId?: string;
  podId?: string;
  workflowId?: string;
  onSave: () => void;
  onRun: () => void;
  onStop?: () => void;
  onDeployPanel: () => void;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onGenerate: () => void;
  onHistory: () => void;
  onVersions: () => void;
  onShare: () => void;
  onComments: () => void;
  onEvals: () => void;
  onExport: () => void;
  onImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onAutoSaveToggle: () => void;
}

/* ------------------------------------------------------------------ */
/*  Tooltip button helper                                               */
/* ------------------------------------------------------------------ */
function TBtn({
  icon, label, shortcut, description, onClick, disabled, variant = 'outline', active, className, size = 'icon-sm',
}: {
  icon: IconSvgElement;
  label: string;
  shortcut?: string;
  description?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'outline' | 'ghost' | 'secondary';
  active?: boolean;
  size?: 'icon-sm' | 'sm';
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size={size}
          variant={active ? 'secondary' : variant}
          onClick={onClick}
          disabled={disabled}
          className={className}
        >
          <HugeiconsIcon icon={icon} className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="flex flex-col gap-0.5 max-w-48">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </div>
        {description && <span className="text-[10px] opacity-70 leading-snug">{description}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Keyboard shortcuts panel                                            */
/* ------------------------------------------------------------------ */
const SHORTCUT_GROUPS = [
  {
    label: 'Canvas',
    items: [
      { keys: ['Ctrl', 'F'],       desc: 'Search nodes'              },
      { keys: ['F'],               desc: 'Fit view'                   },
      { keys: ['G'],               desc: 'Pan (grab) mode'            },
      { keys: ['V'],               desc: 'Select mode'                },
      { keys: ['A'],               desc: 'Auto-layout nodes'          },
      { keys: ['Ctrl', 'Z'],       desc: 'Undo'                       },
      { keys: ['Ctrl', 'Y'],       desc: 'Redo'                       },
      { keys: ['Del'],             desc: 'Delete selected node'        },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { keys: ['Ctrl', 'S'],       desc: 'Save'                       },
      { keys: ['Ctrl', 'Enter'],   desc: 'Run workflow'                },
      { keys: ['Ctrl', 'G'],       desc: 'Generate with AI'           },
      { keys: ['Ctrl', 'L'],       desc: 'Auto-layout'                },
      { keys: ["Ctrl", "'"],       desc: 'Open comments'              },
    ],
  },
  {
    label: 'Nodes',
    items: [
      { keys: ['Drag'],            desc: 'Drop from library to canvas' },
      { keys: ['Dbl-click'],       desc: 'Edit edge label'             },
      { keys: ['?'],               desc: 'Show this panel'             },
    ],
  },
];

function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-[520px] max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <HugeiconsIcon icon={KeyboardIcon} className="size-4 text-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold">Keyboard shortcuts</p>
              <p className="text-[10px] text-muted-foreground">Press <kbd className="rounded border border-border bg-muted px-1 py-px text-[9px] font-medium">Esc</kbd> or <kbd className="rounded border border-border bg-muted px-1 py-px text-[9px] font-medium">?</kbd> to close</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Body -- two-column grid */}
        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item.desc} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-foreground/80">{item.desc}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {item.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-0.5">
                            {i > 0 && <span className="text-[10px] text-muted-foreground/40 mx-0.5">+</span>}
                            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted/80 px-1.5 font-sans text-[10px] font-medium text-foreground/70 shadow-[0_1px_0_0] shadow-border">
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
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

const STATUS_COLOR: Record<string, string> = {
  queued:    'text-muted-foreground',
  running:   'text-blue-500',
  completed: 'text-green-500',
  failed:    'text-destructive',
  cancelled: 'text-muted-foreground',
  stopped:   'text-muted-foreground',
  suspended: 'text-amber-500',
};

/* ------------------------------------------------------------------ */
/*  Toolbar                                                             */
/* ------------------------------------------------------------------ */
export function Toolbar({
  workflowName, isSaving, isRunning, isGenerating, runStatus, validationState,
  deployPanelOpen, historyOpen, versionsOpen, shareOpen, commentsOpen, evalsOpen,
  isDeployed, canUndo, canRedo, autoSave,
  token, workspaceId, podId, workflowId,
  onSave, onRun, onStop, onDeployPanel, onBack, onNameChange, onGenerate,
  onHistory, onVersions, onShare, onComments, onEvals,
  onExport, onImport, onUndo, onRedo, onAutoLayout, onAutoSaveToggle,
}: ToolbarProps) {
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(workflowName);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalName(workflowName); }, [workflowName]);
  useEffect(() => { if (editingName) inputRef.current?.focus(); }, [editingName]);

  // "?" shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!inInput && e.key === '?') { e.preventDefault(); setShortcutsOpen((v) => !v); }
      if (e.key === 'Escape' && shortcutsOpen) setShortcutsOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOpen]);

  function commitName() {
    const trimmed = localName.trim() || workflowName;
    setLocalName(trimmed);
    onNameChange(trimmed);
    setEditingName(false);
  }

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3 z-10">
        <div className="flex items-center gap-2">
          <TBtn
            icon={ArrowLeft01Icon}
            label="Back to workflows"
            description="Exit the builder"
            onClick={onBack}
          />

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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setEditingName(true)}
                  className="max-w-64 truncate text-sm font-semibold text-foreground hover:text-muted-foreground cursor-text"
                >
                  {workflowName}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>Click to rename</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          {runStatus && (
            <span className={`flex items-center gap-1.5 text-xs font-medium capitalize ${STATUS_COLOR[runStatus.status] ?? 'text-muted-foreground'}`}>
              {runStatus.status === 'running' && <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />}
              {runStatus.status === 'failed' && <span className="size-1.5 rounded-full bg-destructive" />}
              {runStatus.status === 'suspended' && <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />}
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

          {token && workspaceId && podId && workflowId && (
            <PresenceAvatars token={token} workspaceId={workspaceId} podId={podId} workflowId={workflowId} />
          )}

          <TBtn icon={UndoIcon} label="Undo" shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo} />
          <TBtn icon={RedoIcon} label="Redo" shortcut="Ctrl+Y" onClick={onRedo} disabled={!canRedo} />
          <TBtn
            icon={AlignSelectionIcon}
            label="Auto-layout"
            shortcut="A"
            description="Rearrange nodes left-to-right"
            onClick={onAutoLayout}
            disabled={isGenerating}
          />

          <Separator orientation="vertical" className="h-4" />

          <TBtn
            icon={ClockIcon}
            label="Run history"
            description="Browse past executions"
            onClick={onHistory}
            active={historyOpen}
          />
          <TBtn
            icon={GitBranchIcon}
            label="Version history"
            description="Restore or compare saved versions"
            onClick={onVersions}
            active={versionsOpen}
          />
          <TBtn
            icon={Share01Icon}
            label="Share"
            description="Invite collaborators or generate a link"
            onClick={onShare}
            active={shareOpen}
          />
          <TBtn
            icon={BubbleChatIcon}
            label="Comments"
            shortcut="Ctrl+'"
            description="Leave and resolve comments"
            onClick={onComments}
            active={commentsOpen}
          />
          <TBtn
            icon={TestTube01Icon}
            label="Evals"
            description="Define and run evals against this workflow"
            onClick={onEvals}
            active={evalsOpen}
          />
          <TBtn
            icon={Upload04Icon}
            label="Import"
            description="Load a workflow from a JSON file"
            onClick={onImport}
          />
          <TBtn
            icon={Download04Icon}
            label="Export"
            description="Download this workflow as JSON"
            onClick={onExport}
          />

          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span>Generate with AI</span>
                <Kbd>Ctrl+G</Kbd>
              </div>
              <span className="text-[10px] opacity-70">Describe a workflow in plain text</span>
            </TooltipContent>
          </Tooltip>

          <TBtn
            icon={AlarmClockIcon}
            label={autoSave ? 'Auto-save on' : 'Auto-save off'}
            description={autoSave ? 'Saves every 30s — click to disable' : 'Click to enable auto-save every 30s'}
            onClick={onAutoSaveToggle}
            active={autoSave}
            className={autoSave ? 'text-green-600 border-green-300 dark:text-green-400' : ''}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={onSave} disabled={isSaving || isGenerating}>
                <HugeiconsIcon icon={isSaving ? Loading01Icon : FloppyDiskIcon} className={isSaving ? 'animate-spin' : ''} />
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="flex items-center gap-2">
              Save workflow <Kbd>Ctrl+S</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={deployPanelOpen ? 'secondary' : isDeployed ? 'outline' : 'outline'}
                onClick={onDeployPanel}
                disabled={isGenerating}
                className={isDeployed && !deployPanelOpen ? 'text-green-700 border-green-300 dark:text-green-400' : ''}
              >
                <HugeiconsIcon
                  icon={isDeployed ? CheckmarkCircle01Icon : CloudUploadIcon}
                  className="size-3.5"
                />
                {isDeployed ? 'Live' : 'Deploy'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="flex flex-col gap-0.5">
              <span>{isDeployed ? 'Deployment & triggers' : 'Deploy workflow'}</span>
              <span className="text-[10px] opacity-70">Configure deployment, webhooks and REST API</span>
            </TooltipContent>
          </Tooltip>

          {runStatus?.status === 'running' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  onClick={onStop}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>Abort execution</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={onRun} disabled={isRunning || isGenerating}>
                  <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                  Run
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="flex items-center gap-2">
                Run workflow <Kbd>Ctrl+Enter</Kbd>
              </TooltipContent>
            </Tooltip>
          )}

          <Separator orientation="vertical" className="h-4" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShortcutsOpen((v) => !v)}
                className={`flex size-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 ${shortcutsOpen ? 'bg-muted border-border text-foreground' : 'border-border'}`}
              >
                <HugeiconsIcon icon={KeyboardIcon} className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="flex items-center gap-2">
              Keyboard shortcuts <Kbd>?</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {shortcutsOpen && <ShortcutsPanel onClose={() => setShortcutsOpen(false)} />}
    </TooltipProvider>
  );
}
