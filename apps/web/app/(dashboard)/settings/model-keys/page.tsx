'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';

interface Secret { id: string; name: string; createdAt: string }

interface ModelProvider {
  key: string;
  label: string;
  placeholder: string;
  docsUrl: string;
  hint: string;
  inputType?: 'password' | 'text';
}

const PROVIDERS: ModelProvider[] = [
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'Anthropic',
    placeholder: 'sk-ant-…',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    hint: 'Powers Claude models (claude-sonnet, claude-opus, etc.)',
  },
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI',
    placeholder: 'sk-…',
    docsUrl: 'https://platform.openai.com/api-keys',
    hint: 'Powers GPT-4o, GPT-4 Turbo, and other OpenAI models',
  },
  {
    key: 'GOOGLE_API_KEY',
    label: 'Google AI',
    placeholder: 'AIza…',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    hint: 'Powers Gemini models (gemini-1.5-pro, gemini-flash, etc.)',
  },
  {
    key: 'GROQ_API_KEY',
    label: 'Groq',
    placeholder: 'gsk_…',
    docsUrl: 'https://console.groq.com/keys',
    hint: 'Fast inference for Llama, Mixtral, and Gemma models',
  },
  {
    key: 'OLLAMA_BASE_URL',
    label: 'Ollama (local)',
    placeholder: 'http://localhost:11434',
    docsUrl: 'https://ollama.com',
    hint: 'Self-hosted Ollama instance — run Llama, Mistral, Qwen, and others locally',
    inputType: 'text',
  },
];

export default function ModelKeysPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function load() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<Secret[]>(`/workspaces/${activeWorkspace.id}/secrets`);
      setSecrets(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading]);

  function isSet(key: string) {
    return secrets.some((s) => s.name === key);
  }

  function secretId(key: string) {
    return secrets.find((s) => s.name === key)?.id;
  }

  async function handleSave(key: string) {
    const value = inputs[key]?.trim();
    if (!value || !activeWorkspace) return;
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const existing = secretId(key);
      if (existing) {
        await api.delete(`/workspaces/${activeWorkspace.id}/secrets/${existing}`);
      }
      const created = await api.post<Secret>(`/workspaces/${activeWorkspace.id}/secrets`, { name: key, value });
      setSecrets((prev) => [...prev.filter((s) => s.name !== key), created]);
      setInputs((p) => ({ ...p, [key]: '' }));
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2500);
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleDelete(key: string) {
    const id = secretId(key);
    if (!id || !activeWorkspace) return;
    setDeleting((p) => ({ ...p, [key]: true }));
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/secrets/${id}`);
      setSecrets((prev) => prev.filter((s) => s.name !== key));
    } finally {
      setDeleting((p) => ({ ...p, [key]: false }));
    }
  }

  if (wsLoading || loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium">Model API Keys</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add API keys for AI model providers. Keys are stored encrypted and used by Agent nodes when selecting a model.
          Values are write-only — re-enter to rotate.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((p) => {
          const set = isSet(p.key);
          const secret = secrets.find((s) => s.name === p.key);
          return (
            <div key={p.key} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{p.label}</p>
                    {set ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <span className="size-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Not set
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.hint}</p>
                  {set && secret && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Set {new Date(secret.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {set && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive text-xs"
                    disabled={deleting[p.key]}
                    onClick={() => void handleDelete(p.key)}
                  >
                    {deleting[p.key] ? 'Removing…' : 'Remove'}
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground font-mono">{p.key}</Label>
                  <Input
                    type={p.inputType === 'text' ? 'text' : 'password'}
                    placeholder={set && p.inputType !== 'text' ? '••••••••••••  (re-enter to rotate)' : p.placeholder}
                    value={inputs[p.key] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(p.key); }}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  className="self-end"
                  disabled={!inputs[p.key]?.trim() || saving[p.key]}
                  onClick={() => void handleSave(p.key)}
                >
                  {saving[p.key] ? 'Saving…' : saved[p.key] ? 'Saved!' : set ? 'Rotate' : 'Save'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How model keys are used</p>
        <p>When an Agent node specifies a model (e.g. <code className="font-mono bg-muted px-1 rounded">claude-sonnet-4-6</code>), Linea picks the matching provider key from your workspace secrets. If no key is set, the platform falls back to the default environment-level key (if configured). For Ollama, set the base URL to your local or remote Ollama server — no API key required.</p>
      </div>
    </div>
  );
}
