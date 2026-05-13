'use client';

import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, FloppyDiskIcon, PlayIcon, Loading01Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Separator } from '@linea/ui/components/separator';

interface ToolbarProps {
  workflowName: string;
  isSaving: boolean;
  isRunning: boolean;
  isGenerating: boolean;
  runStatus: { id: string; status: string } | null;
  onSave: () => void;
  onRun: () => void;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onGenerate: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-muted-foreground',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-destructive',
  cancelled: 'text-muted-foreground',
  suspended: 'text-yellow-500',
};

export function Toolbar({ workflowName, isSaving, isRunning, isGenerating, runStatus, onSave, onRun, onBack, onNameChange, onGenerate }: ToolbarProps) {
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
        <Button size="sm" onClick={onRun} disabled={isRunning || isGenerating}>
          <HugeiconsIcon icon={isRunning ? Loading01Icon : PlayIcon} className={isRunning ? 'animate-spin' : ''} />
          Run
        </Button>
      </div>
    </div>
  );
}
