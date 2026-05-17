'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { Switch } from '@linea/ui/components/switch';
import { Textarea } from '@linea/ui/components/textarea';
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from '@linea/ui/components/native-select';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { VariableChips } from '../variable-picker';
import { cn } from '@linea/ui/lib/utils';

interface AgentPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
  nodes?: Node[];
  nodeId?: string;
}

const modelGroups = [
  {
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
      { value: 'claude-opus-4-7',            label: 'Claude Opus 4.7' },
      { value: 'claude-haiku-4-5',           label: 'Claude Haiku 4.5' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    ],
  },
  {
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o',      label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'o4-mini',     label: 'o4 Mini (Reasoning)' },
    ],
  },
  {
    label: 'Google',
    models: [
      { value: 'gemini-2.0-flash',             label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro Preview' },
    ],
  },
  {
    label: 'Groq',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
      { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B (Groq)' },
    ],
  },
  {
    label: 'Ollama (local)',
    models: [
      { value: 'llama3.2',    label: 'Llama 3.2' },
      { value: 'llama3.1',    label: 'Llama 3.1 8B' },
      { value: 'mistral',     label: 'Mistral 7B' },
      { value: 'qwen2.5',     label: 'Qwen 2.5' },
      { value: 'deepseek-r1', label: 'DeepSeek R1' },
    ],
  },
];

/* ─── Slash command menu ─────────────────────────────────────────── */
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
    .filter((n) => n.id !== currentNodeId && n.type !== 'note' && n.type !== 'end')
    .map((n) => {
      const name = (n.data?.nodeName as string) || (n.data?.label as string) || n.type || n.id;
      return { label: `{{${name}}}`, insert: `{{${name}}}`, desc: `Output from "${name}" node` };
    });

  return [...base, ...nodeRefs];
}

/* ─── Rich instructions textarea ────────────────────────────────── */
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

  function closeMenu() {
    setSlashOpen(false);
    setSlashQuery('');
    setSlashIdx(0);
  }

  function insertCommand(cmd: SlashCmd) {
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
  }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slashOpen, filtered, slashIdx]);

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
      if (/\s/.test(afterSlash) || caret < slashPos) {
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

  useEffect(() => {
    if (slashOpen && filtered.length === 0) closeMenu();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length, slashOpen]);

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

/* ─── Main panel ─────────────────────────────────────────────────── */
export function AgentPanel({ data, onUpdate, nodes = [], nodeId }: AgentPanelProps) {
  const instrRef = useRef<HTMLTextAreaElement>(null);
  const instructions = (data.instructions as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="agent-model">Model</Label>
        <NativeSelect
          id="agent-model"
          value={(data.model as string) ?? 'claude-sonnet-4-6'}
          onChange={(e) => onUpdate({ model: e.target.value })}
          className="w-full"
        >
          {modelGroups.map((g) => (
            <NativeSelectOptGroup key={g.label} label={g.label}>
              {g.models.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
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
        {!!data.enableLongTermMemory && (
          <p className="text-[10px] text-muted-foreground">
            When enabled, the agent will automatically recall relevant facts stored by previous runs of this workflow via <code>memory_store</code>. Make sure <code>memory_store</code> and <code>memory_search</code> are included in the tools list.
          </p>
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
