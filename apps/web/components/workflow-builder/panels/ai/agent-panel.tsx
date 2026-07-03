'use client';

import { useRef, useState, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { Switch } from '@linea/ui/components/switch';
import { Textarea } from '@linea/ui/components/textarea';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { Input } from '@linea/ui/components/input';
import { VariableChips } from '../../variable-picker';
import { ModelPicker } from '../../model-picker';
import { cn } from '@linea/ui/lib/utils';

interface AgentPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

/** Built-in tools agents can use — mirrors BUILTIN_TOOLS in tools/definitions.ts */
const AGENT_TOOLS: Array<{
  name: string;
  label: string;
  description: string;
  approvalTag: 'auto' | 'mutation' | 'always';
}> = [
  { name: 'http_request',   label: 'HTTP Request',   description: 'Call any REST API or URL', approvalTag: 'mutation' },
  { name: 'run_javascript', label: 'Run JavaScript',  description: 'Execute a JS snippet for data transforms', approvalTag: 'always' },
  { name: 'ask_human',      label: 'Ask Human',       description: 'Pause and ask the user a question', approvalTag: 'always' },
  { name: 'memory_store',   label: 'Memory: Store',   description: 'Persist facts across executions', approvalTag: 'auto' },
  { name: 'memory_search',  label: 'Memory: Search',  description: 'Recall facts from previous runs', approvalTag: 'auto' },
  { name: 'read_variable',  label: 'Read Variable',   description: 'Read a named workflow variable', approvalTag: 'auto' },
  { name: 'write_variable', label: 'Write Variable',  description: 'Set a named workflow variable', approvalTag: 'auto' },
];

const APPROVAL_TAG_STYLES: Record<string, string> = {
  auto:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  mutation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  always:   'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};
const APPROVAL_TAG_LABELS: Record<string, string> = {
  auto: 'auto', mutation: 'needs approval', always: 'always approved',
};

interface SlashCmd {
  label: string;
  insert: string;
  desc: string;
}

function buildSlashCommands(nodes: Node[], currentNodeId?: string): SlashCmd[] {
  const base: SlashCmd[] = [
    { label: '{{lastOutput}}',          insert: '{{lastOutput}}',          desc: 'Output from previous node' },
    { label: '{{variables.x}}',         insert: '{{variables.}}',          desc: 'A named workflow variable' },
    { label: '{{input.x}}',             insert: '{{input.}}',              desc: 'Workflow input field' },
    { label: '{{executionId}}',         insert: '{{executionId}}',         desc: 'Current execution ID' },
    { label: '{{podId}}',               insert: '{{podId}}',               desc: 'Current pod ID' },
  ];

  const nodeRefs: SlashCmd[] = nodes
    .filter((n) => n.id !== currentNodeId && n.type !== 'note' && n.type !== 'end' && n.type !== 'frame')
    .map((n) => {
      const name = (n.data?.nodeName as string) || (n.data?.label as string) || n.type || n.id;
      return { label: `{{${name}}}`, insert: `{{${name}}}`, desc: `Output from "${name}" node` };
    });

  return [...base, ...nodeRefs];
}

interface RichTextareaProps {
  value: string;
  onChange: (v: string) => void;
  nodes: Node[];
  currentNodeId?: string;
  rows?: number;
  placeholder?: string;
}

function RichTextarea({ value, onChange, nodes, currentNodeId, rows = 8, placeholder }: RichTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);
  const [slashPos, setSlashPos] = useState(0); // caret position when '/' was typed

  const allCmds = buildSlashCommands(nodes, currentNodeId);
  const filtered = slashQuery
    ? allCmds.filter((c) => c.label.toLowerCase().includes(slashQuery.toLowerCase()) || c.desc.toLowerCase().includes(slashQuery.toLowerCase()))
    : allCmds;

  const closeMenu = useCallback(() => {
    setSlashOpen(false);
    setSlashQuery('');
    setSlashIdx(0);
  }, []);

  const insertCommand = useCallback((cmd: SlashCmd) => {
    const el = ref.current;
    if (!el) return;
    const before = value.slice(0, slashPos - 1); // remove the '/'
    const after = value.slice(el.selectionStart ?? slashPos);
    const next = before + cmd.insert + after;
    onChange(next);
    closeMenu();
    requestAnimationFrame(() => {
      const pos = before.length + cmd.insert.length;
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
    });
  }, [value, slashPos, onChange, closeMenu]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!slashOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSlashIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSlashIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filtered[slashIdx]) insertCommand(filtered[slashIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  }, [slashOpen, filtered, slashIdx, insertCommand, closeMenu]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;

    // Detect '/' typed at start or after whitespace
    const charBefore = next[caret - 1];
    const twoBack = next[caret - 2];
    if (charBefore === '/' && (!twoBack || /\s/.test(twoBack))) {
      setSlashOpen(true);
      setSlashPos(caret);
      setSlashQuery('');
      setSlashIdx(0);
    } else if (slashOpen) {
      // Update query: everything typed since the '/'
      const afterSlash = next.slice(slashPos, caret);
      const nextFiltered = allCmds.filter((c) => c.label.toLowerCase().includes(afterSlash.toLowerCase()) || c.desc.toLowerCase().includes(afterSlash.toLowerCase()));
      if (/\s/.test(afterSlash) || caret < slashPos || nextFiltered.length === 0) {
        closeMenu();
      } else {
        setSlashQuery(afterSlash);
        setSlashIdx(0);
      }
    }
  }

  // File drop / paste from clipboard
  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const snippet = `\n--- ${file.name} ---\n${content}\n--- end ${file.name} ---\n`;
      onChange(value + snippet);
    };
    reader.readAsText(file);
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder={placeholder ?? 'System prompt / instructions…\nType / for variable reference'}
        className="resize-y font-sans text-xs"
      />
      {slashOpen && filtered.length > 0 && (
        <div className="absolute left-0 z-50 mt-0.5 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <p className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
            Insert variable
          </p>
          <ul className="max-h-48 overflow-y-auto py-0.5">
            {filtered.map((cmd, i) => (
              <li
                key={cmd.label}
                className={cn(
                  'flex cursor-pointer items-start gap-2 px-2.5 py-1.5',
                  i === slashIdx ? 'bg-accent' : 'hover:bg-accent/50',
                )}
                onMouseDown={(e) => { e.preventDefault(); insertCommand(cmd); }}
              >
                <code className="shrink-0 text-[10px] text-foreground font-mono">{cmd.label}</code>
                <span className="text-[10px] text-muted-foreground truncate">{cmd.desc}</span>
              </li>
            ))}
          </ul>
          <p className="px-2.5 py-1 text-[9px] text-muted-foreground border-t border-border">
            <kbd className="rounded border border-border px-1 py-0.5 text-[8px]">Enter</kbd> to insert
            &nbsp;|&nbsp;
            <kbd className="rounded border border-border px-1 py-0.5 text-[8px]">Esc</kbd> to close
          </p>
        </div>
      )}
      <p className="mt-1 text-[9px] text-muted-foreground">
        Type <code className="text-[9px]">/</code> to insert a variable reference. Drop a text file to embed its contents.
      </p>
    </div>
  );
}

export function AgentPanel({ data, onUpdate, nodes = [], nodeId }: AgentPanelProps) {
  const instrRef = useRef<HTMLTextAreaElement>(null);
  const instructions = (data.instructions as string) ?? '';
  const systemPrompt = (data.systemPrompt as string) ?? '';
  const enabledTools = (data.tools as string[]) ?? [];

  function toggleTool(name: string, enabled: boolean) {
    const next = enabled
      ? [...new Set([...enabledTools, name])]
      : enabledTools.filter((t) => t !== name);
    onUpdate({ tools: next });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Model</Label>
        <ModelPicker
          value={(data.model as string) ?? 'claude-sonnet-4-6'}
          onValueChange={(v) => onUpdate({ model: v })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-system">System prompt</Label>
        <Textarea
          id="agent-system"
          rows={3}
          value={systemPrompt}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant…"
          className="resize-y font-sans text-xs"
        />
        <p className="text-[10px] text-muted-foreground">Sent as the system message. Defines the agent&apos;s persona and constraints.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Instructions</Label>
        <RichTextarea
          value={instructions}
          onChange={(v) => onUpdate({ instructions: v })}
          nodes={nodes}
          currentNodeId={nodeId}
          rows={8}
        />
        <VariableChips
          nodes={nodes}
          currentNodeId={nodeId}
          value={instructions}
          onChange={(v) => onUpdate({ instructions: v })}
          fieldRef={instrRef}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="agent-maxsteps" className="text-[10px]">Max steps</Label>
          <Input
            id="agent-maxsteps"
            type="number"
            min={1}
            max={50}
            value={(data.maxSteps as number) ?? 10}
            onChange={(e) => onUpdate({ maxSteps: parseInt(e.target.value) || 10 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="agent-temp" className="text-[10px]">Temperature</Label>
          <Input
            id="agent-temp"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={(data.temperature as number) ?? 0.7}
            onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="agent-maxtokens" className="text-[10px]">Max tokens</Label>
          <Input
            id="agent-maxtokens"
            type="number"
            min={256}
            max={128000}
            step={256}
            value={(data.maxTokens as number) ?? 4096}
            onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) || 4096 })}
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="agent-history" className="cursor-pointer">Include chat history</Label>
        <Switch
          id="agent-history"
          checked={!!(data.includeChatHistory)}
          onCheckedChange={(v) => onUpdate({ includeChatHistory: v })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer" htmlFor="agent-ltm">Long-term memory</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Inject memories from past executions into context</p>
          </div>
          <Switch
            id="agent-ltm"
            checked={!!(data.enableLongTermMemory)}
            onCheckedChange={(v) => onUpdate({ enableLongTermMemory: v })}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div>
          <Label>Tools</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Capabilities the agent can invoke during its reasoning loop.
          </p>
        </div>
        <div className="space-y-1.5">
          {AGENT_TOOLS.map((tool) => {
            const enabled = enabledTools.includes(tool.name);
            return (
              <button
                key={tool.name}
                type="button"
                onClick={() => toggleTool(tool.name, !enabled)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  enabled
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-transparent hover:bg-muted/50',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                  enabled ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background',
                )}>
                  {enabled && (
                    <svg viewBox="0 0 10 10" className="size-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium">{tool.label}</span>
                    <span className={cn('rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide', APPROVAL_TAG_STYLES[tool.approvalTag])}>
                      {APPROVAL_TAG_LABELS[tool.approvalTag]}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        {enabledTools.length === 0 && (
          <p className="text-[10px] text-muted-foreground/60 italic">No tools selected — the agent will respond without calling external services.</p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer" htmlFor="agent-structured">Structured output</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Force the model to return typed JSON</p>
          </div>
          <Switch
            id="agent-structured"
            checked={!!(data.outputSchema)}
            onCheckedChange={(v) => onUpdate({ outputSchema: v ? '{\n  "type": "object",\n  "properties": {}\n}' : '' })}
          />
        </div>
        {!!data.outputSchema && (
          <div className="space-y-1.5">
            <Label>JSON Schema</Label>
            <Textarea
              rows={8}
              value={(data.outputSchema as string) ?? ''}
              onChange={(e) => onUpdate({ outputSchema: e.target.value })}
              className="resize-y font-mono text-xs"
              placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}'
            />
            <p className="text-[10px] text-muted-foreground">
              The model&apos;s output will be parsed as JSON matching this schema. The node output will be an object, not a string.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
