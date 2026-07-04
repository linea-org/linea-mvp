'use client';

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

  if (wsLoading || loading || modelsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => saveSettings.mutate(values))} className="space-y-8">
      <div>
        <h2 className="text-sm font-medium">Model Preferences</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure the execution supervisor model and RAG retrieval settings for this workspace.
        </p>
      </div>

      <div className="space-y-3" data-tour="supervisor-model">
        <div>
          <p className="text-sm font-medium">Execution Supervisor Model</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When a node fails, Linea's supervisor uses this model to decide whether to retry, skip, or abort.
            Pick a fast, cheap model — it only runs on failures, not on every execution.
          </p>
        </div>
        <select
          className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
          {...register('supervisorModel')}
        >
          {ALL_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Default: <span className="font-mono">claude-haiku-4-5</span>. The model must have an API key configured in{' '}
          <span className="font-medium">Connections</span>.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">RAG Retrieval Settings</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controls how knowledge base entries are split and how strictly similarity is enforced.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <p className="text-[10px] text-muted-foreground">0.0–1.0. Higher = stricter (0.75 default)</p>
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
            <p className="text-[10px] text-muted-foreground">Characters per chunk (1000 default)</p>
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
            <p className="text-[10px] text-muted-foreground">Overlap between chunks (200 default)</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saveSettings.isPending}>
          {saveSettings.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
