'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  entryCount: number;
  updatedAt: string;
}

export default function KnowledgePage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<KnowledgeBase[]>(`/workspaces/${activeWorkspace.id}/knowledge-bases`);
      setBases(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading]);

  async function handleCreate() {
    if (!activeWorkspace || !name.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const kb = await api.post<KnowledgeBase>(`/workspaces/${activeWorkspace.id}/knowledge-bases`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setBases((prev) => [{ ...kb, entryCount: 0 }, ...prev]);
      setDialogOpen(false);
      setName('');
      setDescription('');
      router.push(`/knowledge/${kb.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Knowledge Bases</h1>
          <p className="text-sm text-muted-foreground">Workspace-wide document collections for RAG retrieval</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>New knowledge base</Button>
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : bases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No knowledge bases yet.</p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>Create knowledge base</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bases.map((kb) => (
            <button
              key={kb.id}
              onClick={() => router.push(`/knowledge/${kb.id}`)}
              className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium">{kb.name}</p>
              {kb.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{kb.description}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {kb.entryCount} {kb.entryCount === 1 ? 'entry' : 'entries'} · Updated {new Date(kb.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create knowledge base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Product docs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input
                placeholder="What does this knowledge base contain?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={!name.trim() || creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
