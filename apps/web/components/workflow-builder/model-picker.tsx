'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon, Tick02Icon, SearchIcon, AiBrain01Icon, SparklesIcon,
  FlashIcon, EyeIcon, CodeIcon, DollarCircleIcon,
} from '@hugeicons/core-free-icons';
import { Popover, PopoverContent, PopoverTrigger } from '@linea/ui/components/popover';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { cn } from '@linea/ui/lib/utils';
import { createApiClient } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types (mirrors backend ModelDefinition)                            */
/* ------------------------------------------------------------------ */
interface ModelDef {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  tier: 'fast' | 'balanced' | 'powerful' | 'reasoning';
  useCases: string[];
  capabilities: { vision: boolean; functionCalling: boolean; extendedThinking?: boolean };
  costPer1mTokens: { input: number; output: number };
  badge?: string;
}

/* ------------------------------------------------------------------ */
/*  Provider metadata                                                   */
/* ------------------------------------------------------------------ */
const PROVIDER_META: Record<string, { label: string; color: string; dot: string }> = {
  anthropic: { label: 'Anthropic', color: 'text-orange-600', dot: 'bg-orange-500' },
  openai:    { label: 'OpenAI',    color: 'text-green-600',  dot: 'bg-green-500' },
  xai:       { label: 'xAI',       color: 'text-foreground', dot: 'bg-foreground' },
  groq:      { label: 'Groq',      color: 'text-orange-500', dot: 'bg-orange-400' },
  google:    { label: 'Google',    color: 'text-blue-600',   dot: 'bg-blue-500' },
  ollama:    { label: 'Ollama',    color: 'text-purple-600', dot: 'bg-purple-500' },
};

const PROVIDER_ORDER = ['anthropic', 'openai', 'xai', 'groq', 'google', 'ollama'];

/* ------------------------------------------------------------------ */
/*  Badge metadata                                                      */
/* ------------------------------------------------------------------ */
const BADGE_META: Record<string, { label: string; className: string }> = {
  'recommended':    { label: 'Recommended',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  'best-for-agents':{ label: 'Best for agents',className: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' },
  'best-reasoning': { label: 'Best reasoning', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' },
  'best-value':     { label: 'Best value',     className: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  'fastest':        { label: 'Fastest',        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' },
  'most-capable':   { label: 'Most capable',   className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
};

/* ------------------------------------------------------------------ */
/*  Tag icons & labels                                                  */
/* ------------------------------------------------------------------ */
function ModelTags({ model }: { model: ModelDef }) {
  const tags: { icon: unknown; label: string; className: string }[] = [];

  if (model.tier === 'reasoning') {
    tags.push({ icon: AiBrain01Icon, label: 'Reasoning', className: 'text-violet-600 dark:text-violet-400' });
  }
  if (model.capabilities.vision) {
    tags.push({ icon: EyeIcon, label: 'Vision', className: 'text-teal-600 dark:text-teal-400' });
  }
  if (model.useCases.includes('coding')) {
    tags.push({ icon: CodeIcon, label: 'Coding', className: 'text-orange-600 dark:text-orange-400' });
  }
  if (model.tier === 'fast') {
    tags.push({ icon: FlashIcon, label: 'Fast', className: 'text-blue-600 dark:text-blue-400' });
  }
  if (model.useCases.includes('long-context') || model.contextWindow >= 200_000) {
    tags.push({ icon: SparklesIcon, label: `${(model.contextWindow / 1000).toFixed(0)}K ctx`, className: 'text-cyan-600 dark:text-cyan-400' });
  }
  if (model.costPer1mTokens.input <= 0.5 && model.costPer1mTokens.input > 0) {
    tags.push({ icon: DollarCircleIcon, label: 'Affordable', className: 'text-green-600 dark:text-green-400' });
  }
  if (model.costPer1mTokens.input === 0) {
    tags.push({ icon: DollarCircleIcon, label: 'Free', className: 'text-green-600 dark:text-green-400' });
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 4).map((t) => (
        <span key={t.label} className={cn('inline-flex items-center gap-0.5 text-[9px] font-medium', t.className)}>
          <HugeiconsIcon icon={t.icon as any} className="size-2.5" />
          {t.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback static list (used when API is unavailable)                */
/* ------------------------------------------------------------------ */
const FALLBACK_MODELS: ModelDef[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: 'Best all-around for agentic workflows', contextWindow: 200000, maxOutputTokens: 16000, tier: 'balanced', useCases: ['general', 'coding'], capabilities: { vision: true, functionCalling: true }, costPer1mTokens: { input: 3, output: 15 }, badge: 'best-for-agents' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fastest Claude model', contextWindow: 200000, maxOutputTokens: 8000, tier: 'fast', useCases: ['fast-response'], capabilities: { vision: true, functionCalling: true }, costPer1mTokens: { input: 0.8, output: 4 } },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Flagship multimodal model', contextWindow: 128000, maxOutputTokens: 16384, tier: 'balanced', useCases: ['general', 'vision'], capabilities: { vision: true, functionCalling: true }, costPer1mTokens: { input: 2.5, output: 10 }, badge: 'recommended' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Ultra-affordable with vision', contextWindow: 128000, maxOutputTokens: 16384, tier: 'fast', useCases: ['fast-response'], capabilities: { vision: true, functionCalling: true }, costPer1mTokens: { input: 0.15, output: 0.6 }, badge: 'best-value' },
  { id: 'grok-3', name: 'Grok 3', provider: 'xai', description: 'xAI flagship model', contextWindow: 131072, maxOutputTokens: 131072, tier: 'powerful', useCases: ['general', 'coding'], capabilities: { vision: false, functionCalling: true }, costPer1mTokens: { input: 3, output: 15 } },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xai', description: 'Lightweight with reasoning', contextWindow: 131072, maxOutputTokens: 131072, tier: 'reasoning', useCases: ['reasoning'], capabilities: { vision: false, functionCalling: true }, costPer1mTokens: { input: 0.3, output: 0.5 } },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', description: 'Fast open-source inference', contextWindow: 128000, maxOutputTokens: 32768, tier: 'balanced', useCases: ['general'], capabilities: { vision: false, functionCalling: true }, costPer1mTokens: { input: 0.59, output: 0.79 } },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', description: 'Fast multimodal, 1M context', contextWindow: 1048576, maxOutputTokens: 8192, tier: 'fast', useCases: ['fast-response', 'long-context', 'vision'], capabilities: { vision: true, functionCalling: true }, costPer1mTokens: { input: 0.1, output: 0.4 } },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */
interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
  /** When set, only models from this provider are shown and provider tabs are hidden */
  providerFilter?: string;
}

export function ModelPicker({ value, onChange, className, providerFilter }: ModelPickerProps) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>(providerFilter ?? 'all');

  const { data: models } = useQuery({
    queryKey: ['models-registry'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return FALLBACK_MODELS;
      const api = createApiClient(token);
      return api.get<ModelDef[]>('/models').catch(() => FALLBACK_MODELS);
    },
  });

  const allModels = (models ?? FALLBACK_MODELS).filter(
    (m) => !providerFilter || m.provider === providerFilter,
  );
  const selectedModel = allModels.find((m) => m.id === value);

  const providers = useMemo(() => {
    const seen = new Set<string>();
    PROVIDER_ORDER.forEach((p) => {
      if (allModels.some((m) => m.provider === p)) seen.add(p);
    });
    return Array.from(seen);
  }, [allModels]);

  const filtered = useMemo(() => {
    let list = allModels;
    if (activeProvider !== 'all') {
      list = list.filter((m) => m.provider === activeProvider);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.useCases.some((u) => u.includes(q)),
      );
    }
    return list;
  }, [allModels, activeProvider, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelDef[]>();
    PROVIDER_ORDER.forEach((p) => {
      const group = filtered.filter((m) => m.provider === p);
      if (group.length) map.set(p, group);
    });
    return map;
  }, [filtered]);

  const meta = selectedModel ? PROVIDER_META[selectedModel.provider] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors',
            className,
          )}
        >
          {meta && (
            <span className={cn('size-2 rounded-full shrink-0', meta.dot)} />
          )}
          <span className="flex-1 text-left truncate">
            {selectedModel?.name ?? value ?? 'Select a model…'}
          </span>
          {selectedModel?.badge && selectedModel.badge in BADGE_META && (
            <span className={cn('hidden sm:inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0', BADGE_META[selectedModel.badge!]!.className)}>
              {BADGE_META[selectedModel.badge!]!.label}
            </span>
          )}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] p-0"
        align="start"
        sideOffset={4}
      >
        {/* Search */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <HugeiconsIcon icon={SearchIcon} className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="pl-8 h-8 text-xs"
              autoFocus
            />
          </div>
        </div>

        {/* Provider filter tabs — hidden when a providerFilter is set */}
        {!providerFilter && (
          <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveProvider('all')}
              className={cn(
                'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                activeProvider === 'all'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              All
            </button>
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => setActiveProvider(p)}
                className={cn(
                  'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                  activeProvider === p
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {PROVIDER_META[p]?.label ?? p}
              </button>
            ))}
          </div>
        )}

        {/* Model list */}
        <div className="max-h-[340px] overflow-y-auto p-1.5 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">No models match your search.</p>
          ) : (
            Array.from(grouped.entries()).map(([provider, providerModels]) => (
              <div key={provider}>
                <p className={cn('px-2 py-1 text-[9px] font-bold uppercase tracking-widest', PROVIDER_META[provider]?.color ?? 'text-muted-foreground')}>
                  {PROVIDER_META[provider]?.label ?? provider}
                </p>
                <div className="space-y-0.5">
                  {providerModels.map((model) => {
                    const isSelected = model.id === value;
                    const badge = model.badge ? BADGE_META[model.badge] : null;
                    return (
                      <button
                        key={model.id}
                        onClick={() => { onChange(model.id); setOpen(false); setSearch(''); }}
                        className={cn(
                          'w-full text-left rounded-md px-2.5 py-2 transition-colors group',
                          isSelected
                            ? 'bg-accent'
                            : 'hover:bg-muted/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium">{model.name}</span>
                              {badge && (
                                <span className={cn('inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold', badge.className)}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{model.description}</p>
                            <ModelTags model={model} />
                          </div>
                          {isSelected && (
                            <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-foreground shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: cost hint for selected */}
        {selectedModel && selectedModel.costPer1mTokens.input > 0 && (
          <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span className="font-mono">{selectedModel.id}</span>
            <span className="mx-2">·</span>
            ${selectedModel.costPer1mTokens.input}/M in
            · ${selectedModel.costPer1mTokens.output}/M out
            · {(selectedModel.contextWindow / 1000).toFixed(0)}K ctx
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
