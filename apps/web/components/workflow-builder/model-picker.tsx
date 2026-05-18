'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import { cn } from '@linea/ui/lib/utils';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

interface ModelDef {
  id: string;
  name: string;
  provider: string;
  description: string;
  tier: string;
  useCases: string[];
  badge?: string;
  dimensions?: number;
  capabilities: {
    vision: boolean;
    functionCalling: boolean;
    embedding?: boolean;
  };
  costPer1mTokens: { input: number; output: number };
}

const BADGE_STYLES: Record<string, string> = {
  recommended:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'best-for-agents': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'best-reasoning':  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'best-value':      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  fastest:           'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'most-capable':    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
  xai:       'xAI',
  groq:      'Groq',
  google:    'Google',
  ollama:    'Ollama (local)',
};

const PROVIDER_ORDER = ['anthropic', 'openai', 'google', 'xai', 'groq', 'ollama'];

export interface ModelPickerProps {
  value: string;
  onValueChange: (v: string) => void;
  /** Show only embedding-capable models (for retriever / knowledge base) */
  embeddingOnly?: boolean;
  /** Show only models whose useCases intersect with this list */
  filterUseCases?: string[];
  className?: string;
  placeholder?: string;
}

export function ModelPicker({
  value,
  onValueChange,
  embeddingOnly = false,
  filterUseCases,
  className,
  placeholder = 'Select a model…',
}: ModelPickerProps) {
  const [models, setModels] = useState<ModelDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/models`)
      .then((r) => r.json())
      .then((data: unknown) => {
        // ResponseInterceptor wraps all responses in { data: ... }
        const raw = (data as { data?: unknown }).data ?? data;
        const list = Array.isArray(raw) ? (raw as ModelDef[]) : [];
        setModels(list);
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = models.filter((m) => {
    if (embeddingOnly) return m.capabilities.embedding === true;
    if (m.capabilities.embedding) return false;
    if (filterUseCases && filterUseCases.length > 0) {
      return m.useCases.some((uc) => filterUseCases.includes(uc));
    }
    return true;
  });

  const byProvider: Record<string, ModelDef[]> = {};
  for (const m of filtered) {
    (byProvider[m.provider] ??= []).push(m);
  }
  const orderedProviders = PROVIDER_ORDER.filter((p) => byProvider[p]?.length);

  // Used only for showing the badge next to the selected value in the trigger
  const selected = models.find((m) => m.id === value);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('w-full', className)}>
        {/*
          SelectValue MUST always be rendered — Radix needs it in the trigger.
          It displays the selected item's text (the plain name string we pass to SelectItem).
          The badge is shown as a sibling, not inside SelectValue.
        */}
        <SelectValue placeholder={loading ? 'Loading models…' : placeholder} />
        {selected?.badge && (
          <span
            className={cn(
              'ml-1 shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide',
              BADGE_STYLES[selected.badge] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {selected.badge.replace(/-/g, ' ')}
          </span>
        )}
        {embeddingOnly && selected?.dimensions && (
          <span className="ml-1 shrink-0 rounded bg-muted px-1 py-0.5 text-[8px] font-mono text-muted-foreground">
            {selected.dimensions}d
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {loading ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">Loading models…</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No models available for this use case.
          </div>
        ) : (
          orderedProviders.map((provider) => (
            <SelectGroup key={provider}>
              <SelectLabel>{PROVIDER_LABELS[provider] ?? provider}</SelectLabel>
              {byProvider[provider]!.map((m) => (
                /*
                  IMPORTANT: SelectItem wraps ALL children in SelectPrimitive.ItemText,
                  which Radix clones into the trigger's SelectValue when this item is selected.
                  We must pass ONLY the model name as children so the trigger displays cleanly.
                  Hover description is shown via native `title` tooltip.
                  Badges in the dropdown are shown via the SelectItem's data-badge attribute trick
                  (a CSS-only approach) — or more simply via a flex layout that fits in one line.
                */
                <SelectItem
                  key={m.id}
                  value={m.id}
                  title={m.description}
                  className="py-1.5"
                >
                  <span className="flex items-center gap-1.5">
                    {m.name}
                    {m.badge && (
                      <span
                        className={cn(
                          'rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide',
                          BADGE_STYLES[m.badge] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {m.badge.replace(/-/g, ' ')}
                      </span>
                    )}
                    {embeddingOnly && m.dimensions && (
                      <span className="rounded bg-muted px-1 py-0.5 text-[8px] font-mono text-muted-foreground">
                        {m.dimensions}d
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
