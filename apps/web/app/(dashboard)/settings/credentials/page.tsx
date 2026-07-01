'use client';

import { useState } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';

interface Secret {
  id: string;
  name: string;
  createdAt: string;
}

export default function CredentialsPage() {
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [nameError, setNameError] = useState('');

  const { data: secrets = [], isLoading: loading } = useQuery<Secret[]>({
    queryKey: ['secrets', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<Secret[]>(`/workspaces/${wsId}/secrets`);
    },
  });

  function validateName(v: string) {
    if (!v) return 'Name is required';
    if (!/^[A-Z][A-Z0-9_]*$/.test(v)) return 'Must be uppercase letters, digits, and underscores';
    return '';
  }

  const createSecret = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<Secret>(`/workspaces/${wsId}/secrets`, { name: name.trim(), value: value.trim() });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Secret[]>(['secrets', wsId], (prev = []) => [...prev, created]);
      setDialogOpen(false);
      setName('');
      setValue('');
    },
  });

  function handleCreate() {
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    if (!value.trim()) return;
    createSecret.mutate();
  }

  const deleteSecret = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/secrets/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Secret[]>(['secrets', wsId], (prev = []) => prev.filter((s) => s.id !== id));
    },
  });

  if (wsLoading || loading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Secrets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Encrypted key-value pairs used by integration nodes.
            Values are write-only and never returned by the API.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>New secret</Button>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Integration secret names</p>
        <div className="flex flex-wrap gap-2">
          {['SLACK_TOKEN', 'GITHUB_TOKEN', 'NOTION_TOKEN', 'GMAIL_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setName(n); setDialogOpen(true); }}
              className="font-mono text-xs bg-background border rounded px-2 py-0.5 hover:bg-muted transition-colors"
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">Click a name to pre-fill and save it quickly.</p>
      </div>

      {secrets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No secrets yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {secrets.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deleteSecret.isPending && deleteSecret.variables === s.id}
                onClick={() => deleteSecret.mutate(s.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setName(''); setValue(''); setNameError(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add secret</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="OPENAI_API_KEY"
                value={name}
                onChange={(e) => { setName(e.target.value.toUpperCase()); setNameError(''); }}
                className="font-mono"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              <p className="text-xs text-muted-foreground">Uppercase letters, digits, underscores only.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                type="password"
                placeholder="sk-…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
              <p className="text-xs text-muted-foreground">Stored encrypted. Never retrievable after saving.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSecret.isPending || !name || !value}>
              {createSecret.isPending ? 'Saving…' : 'Save secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
