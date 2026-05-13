'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
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

interface ApiKey {
  id: string;
  label: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function loadKeys() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<ApiKey[]>(`/workspaces/${activeWorkspace.id}/api-keys`);
      setKeys(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void loadKeys();
  }, [activeWorkspace, wsLoading]);

  async function handleCreate() {
    if (!activeWorkspace) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const result = await api.post<ApiKey & { key: string }>(
        `/workspaces/${activeWorkspace.id}/api-keys`,
        { label: label.trim() || undefined },
      );
      setNewKey(result.key);
      setKeys((prev) => [...prev, { id: result.id, label: result.label, lastUsedAt: result.lastUsedAt, createdAt: result.createdAt }]);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    await api.delete(`/workspaces/${activeWorkspace.id}/api-keys/${id}`);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  if (wsLoading || loading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
                <p className="text-sm font-medium">{k.label ?? 'Unnamed key'}</p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => void handleRevoke(k.id)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setNewKey(null); setLabel(''); } }}>
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
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setNewKey(null); setLabel(''); }}>
              {newKey ? 'Done' : 'Cancel'}
            </Button>
            {!newKey && (
              <Button onClick={() => void handleCreate()} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
