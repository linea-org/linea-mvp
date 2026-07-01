'use client';

import { useState } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';

interface ApiKey {
  id: string;
  label: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: 'active' | 'expired';
  createdAt: string;
}

export default function ApiKeysPage() {
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [expiresIn, setExpiresIn] = useState<'30d' | '90d' | '365d' | 'never'>('never');
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys = [], isLoading: loading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<ApiKey[]>(`/workspaces/${wsId}/api-keys`);
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<ApiKey & { key: string }>(
        `/workspaces/${wsId}/api-keys`,
        { label: label.trim() || undefined, expiresIn: expiresIn === 'never' ? undefined : expiresIn },
      );
    },
    onSuccess: (result) => {
      setNewKey(result.key);
      queryClient.setQueryData<ApiKey[]>(['api-keys', wsId], (prev = []) => [...prev, {
        id: result.id, label: result.label, lastUsedAt: result.lastUsedAt,
        expiresAt: result.expiresAt, revokedAt: null, status: 'active', createdAt: result.createdAt,
      }]);
    },
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/api-keys/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ApiKey[]>(['api-keys', wsId], (prev = []) => prev.filter((k) => k.id !== id));
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setNewKey(null);
    setLabel('');
    setExpiresIn('never');
  }

  if (wsLoading || loading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">API Keys</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use <code className="text-xs bg-muted px-1 rounded">lnk_…</code> keys to authenticate SDK and programmatic requests.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>New key</Button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{k.label ?? 'Unnamed key'}</p>
                  <Badge
                    variant={k.status === 'active' ? 'default' : 'destructive'}
                    className={k.status === 'active'
                      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-[10px] px-1.5 py-0'
                      : 'text-[10px] px-1.5 py-0'}
                  >
                    {k.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                  {k.expiresAt ? ` · Expires ${new Date(k.expiresAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => revokeKey.mutate(k.id)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Copy this key now — it won't be shown again.
              </p>
              <div className="flex gap-2">
                <Input value={newKey} readOnly className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(newKey)}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
                <Input
                  placeholder="e.g. Production"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createKey.mutate(); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry</Label>
                <NativeSelect
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)}
                  className="h-9 text-sm"
                >
                  <NativeSelectOption value="never">Never</NativeSelectOption>
                  <NativeSelectOption value="30d">30 days</NativeSelectOption>
                  <NativeSelectOption value="90d">90 days</NativeSelectOption>
                  <NativeSelectOption value="365d">1 year</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {newKey ? 'Done' : 'Cancel'}
            </Button>
            {!newKey && (
              <Button onClick={() => createKey.mutate()} disabled={createKey.isPending}>
                {createKey.isPending ? 'Creating…' : 'Create'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
