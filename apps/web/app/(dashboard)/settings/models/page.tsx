"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Skeleton } from "@linea/ui/components/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

interface WorkspaceSettings {
  modelFallbackChain?: string[]
  ragSimilarityThreshold?: number
  ragChunkSize?: number
  ragChunkOverlap?: number
  supervisorModel?: string
}

const ALL_MODELS = [
  // Anthropic
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    status: "production",
  },
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    provider: "anthropic",
    status: "production",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    status: "production",
  },
  // OpenAI
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", status: "production" },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openai",
    status: "production",
  },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", status: "production" },
  { id: "o4-mini", label: "o4 Mini", provider: "openai", status: "production" },
  { id: "o3", label: "o3", provider: "openai", status: "production" },
  // xAI
  { id: "grok-3", label: "Grok 3", provider: "xai", status: "production" },
  {
    id: "grok-3-mini",
    label: "Grok 3 Mini",
    provider: "xai",
    status: "production",
  },
  // Groq — production
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    provider: "groq",
    status: "production",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    provider: "groq",
    status: "production",
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    provider: "groq",
    status: "production",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    provider: "groq",
    status: "production",
  },
  {
    id: "groq/compound",
    label: "Groq Compound",
    provider: "groq",
    status: "production",
  },
  {
    id: "groq/compound-mini",
    label: "Groq Compound Mini",
    provider: "groq",
    status: "production",
  },
  // Groq — preview
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B ✦",
    provider: "groq",
    status: "preview",
  },
  {
    id: "qwen/qwen3-32b",
    label: "Qwen 3 32B ✦",
    provider: "groq",
    status: "preview",
  },
  // Google
  {
    id: "gemini-2.5-pro-preview-05-06",
    label: "Gemini 2.5 Pro",
    provider: "google",
    status: "production",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "google",
    status: "production",
  },
  {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash Lite",
    provider: "google",
    status: "production",
  },
]

export default function ModelPreferencesPage() {
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [chain, setChain] = useState<string[]>([])
  const [addModel, setAddModel] = useState("")
  const [ragThreshold, setRagThreshold] = useState("0.75")
  const [ragChunkSize, setRagChunkSize] = useState("1000")
  const [ragChunkOverlap, setRagChunkOverlap] = useState("200")
  const [supervisorModel, setSupervisorModel] = useState("claude-haiku-4-5")
  const [saved, setSaved] = useState(false)

  async function load() {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const data = await api.get<WorkspaceSettings>(
        `/workspaces/${activeWorkspace.id}/settings`
      )
      setChain(data.modelFallbackChain ?? [])
      setRagThreshold(String(data.ragSimilarityThreshold ?? 0.75))
      setRagChunkSize(String(data.ragChunkSize ?? 1000))
      setRagChunkOverlap(String(data.ragChunkOverlap ?? 200))
      setSupervisorModel(data.supervisorModel ?? "claude-haiku-4-5")
    } finally {
      setLoading(false)
    }
  }
=======
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';

interface WorkspaceSettings {
  ragSimilarityThreshold?: number;
  ragChunkSize?: number;
  ragChunkOverlap?: number;
  supervisorModel?: string;
}

interface ModelsFormValues {
  ragThreshold: string;
  ragChunkSize: string;
  ragChunkOverlap: string;
  supervisorModel: string;
}

interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  status?: 'production' | 'preview' | 'deprecated';
}

export default function ModelPreferencesPage() {
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const wsId = activeWorkspace?.id ?? '';

  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, reset } = useForm<ModelsFormValues>({
    defaultValues: {
      ragThreshold: '0.75',
      ragChunkSize: '1000',
      ragChunkOverlap: '200',
      supervisorModel: 'claude-haiku-4-5',
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  const { data: settings, isLoading: loading } = useQuery<WorkspaceSettings>({
    queryKey: ['workspace-settings', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<WorkspaceSettings>(`/workspaces/${wsId}/settings`);
    },
  });

  const { data: ALL_MODELS = [], isLoading: modelsLoading } = useQuery<ModelDefinition[]>({
    queryKey: ['models'],
    queryFn: async () => {
      const api = await getApi();
      return api.get<ModelDefinition[]>('/models');
    },
  });

  const [syncedWsId, setSyncedWsId] = useState<string | null>(null);
  useEffect(() => {
<<<<<<< HEAD
    if (wsLoading) return
    if (!activeWorkspace) {
      setLoading(false)
      return
    }
    void load()
  }, [activeWorkspace, wsLoading])

  function moveUp(i: number) {
    if (i === 0) return
    setChain((prev) => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i]!, next[i - 1]!]
      return next
    })
  }

  function moveDown(i: number) {
    setChain((prev) => {
      if (i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1]!, next[i]!]
      return next
    })
  }

  function removeModel(i: number) {
    setChain((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addToChain() {
    const id = addModel.trim()
    if (!id || chain.includes(id)) return
    setChain((prev) => [...prev, id])
    setAddModel("")
  }

  async function handleSave() {
    if (!activeWorkspace) return
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.patch(`/workspaces/${activeWorkspace.id}/settings`, {
        modelFallbackChain: chain,
        ragSimilarityThreshold: parseFloat(ragThreshold) || 0.75,
        ragChunkSize: parseInt(ragChunkSize, 10) || 1000,
        ragChunkOverlap: parseInt(ragChunkOverlap, 10) || 200,
        supervisorModel: supervisorModel || "claude-haiku-4-5",
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }
=======
    if (!settings || wsId === syncedWsId) return;
    setSyncedWsId(wsId);
    reset({
      ragThreshold: String(settings.ragSimilarityThreshold ?? 0.75),
      ragChunkSize: String(settings.ragChunkSize ?? 1000),
      ragChunkOverlap: String(settings.ragChunkOverlap ?? 200),
      supervisorModel: settings.supervisorModel ?? 'claude-haiku-4-5',
    });
  }, [settings, wsId, syncedWsId, reset]);

  const saveSettings = useMutation({
    mutationFn: async (values: ModelsFormValues) => {
      const api = await getApi();
      await api.patch(`/workspaces/${wsId}/settings`, {
        ragSimilarityThreshold: parseFloat(values.ragThreshold) || 0.75,
        ragChunkSize: parseInt(values.ragChunkSize, 10) || 1000,
        ragChunkOverlap: parseInt(values.ragChunkOverlap, 10) || 200,
        supervisorModel: values.supervisorModel || 'claude-haiku-4-5',
      });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  if (wsLoading || loading || modelsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

<<<<<<< HEAD
  const availableToAdd = ALL_MODELS.filter((m) => !chain.includes(m.id))

=======
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
  return (
    <form onSubmit={handleSubmit((values) => saveSettings.mutate(values))} className="space-y-8">
      <div>
        <h2 className="text-sm font-medium">Model Preferences</h2>
<<<<<<< HEAD
        <p className="mt-0.5 text-xs text-muted-foreground">
          Configure fallback models and RAG retrieval settings for this
          workspace.
        </p>
      </div>

      {/* ── Fallback chain ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Fallback Model Chain</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When the primary model on an Agent node fails (quota, auth error, or
            overload), Linea tries these models in order. Only models with an
            API key configured in{" "}
            <span className="font-medium">Model Keys</span> will actually be
            used.
          </p>
        </div>

        {chain.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No fallbacks configured. Add models below.
          </p>
        )}

        <div className="space-y-2">
          {chain.map((modelId, i) => {
            const info = ALL_MODELS.find((m) => m.id === modelId)
            return (
              <div
                key={modelId}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {info?.label ?? modelId}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {modelId}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => moveDown(i)}
                    disabled={i === chain.length - 1}
                  >
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      className="size-3.5"
                    />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => removeModel(i)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            value={addModel}
            onChange={(e) => setAddModel(e.target.value)}
          >
            <option value="">Add a fallback model…</option>
            {availableToAdd.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.provider})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={addToChain}
            disabled={!addModel}
          >
            <HugeiconsIcon icon={Add01Icon} className="mr-1 size-3.5" />
            Add
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          You can also type any model ID not listed above directly into the
          field.
        </p>
        <div className="flex gap-2">
          <Input
            className="font-mono text-sm"
            placeholder="Custom model ID, e.g. llama3.2"
            value={addModel}
            onChange={(e) => setAddModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addToChain()
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addToChain}
            disabled={!addModel.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      {/* ── Supervisor model ── */}
=======
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure the execution supervisor model and RAG retrieval settings for this workspace.
        </p>
      </div>

>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
      <div className="space-y-3" data-tour="supervisor-model">
        <div>
          <p className="text-sm font-medium">Execution Supervisor Model</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When a node fails, Linea's supervisor uses this model to decide
            whether to retry, skip, or abort. Pick a fast, cheap model — it only
            runs on failures, not on every execution.
          </p>
        </div>
        <select
          className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
          {...register('supervisorModel')}
        >
          {ALL_MODELS.map((m) => (
<<<<<<< HEAD
            <option key={m.id} value={m.id}>
              {m.label} ({m.provider})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Default: <span className="font-mono">claude-haiku-4-5</span>. The
          model must have an API key configured in{" "}
          <span className="font-medium">Model Keys</span>.
=======
            <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Default: <span className="font-mono">claude-haiku-4-5</span>. The model must have an API key configured in{' '}
          <span className="font-medium">Connections</span>.
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">RAG Retrieval Settings</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Controls how knowledge base entries are split and how strictly
            similarity is enforced.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Similarity Threshold</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="font-mono text-sm"
              {...register('ragThreshold')}
            />
            <p className="text-[10px] text-muted-foreground">
              0.0–1.0. Higher = stricter (0.75 default)
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Chunk Size (chars)</Label>
            <Input
              type="number"
              step="100"
              min="100"
              className="font-mono text-sm"
              {...register('ragChunkSize')}
            />
            <p className="text-[10px] text-muted-foreground">
              Characters per chunk (1000 default)
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Chunk Overlap (chars)</Label>
            <Input
              type="number"
              step="50"
              min="0"
              className="font-mono text-sm"
              {...register('ragChunkOverlap')}
            />
            <p className="text-[10px] text-muted-foreground">
              Overlap between chunks (200 default)
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
<<<<<<< HEAD
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  )
=======
        <Button type="submit" disabled={saveSettings.isPending}>
          {saveSettings.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
}
