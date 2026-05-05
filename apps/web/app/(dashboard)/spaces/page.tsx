'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { useSpace } from '@/contexts/space-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';

interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export default function SpacesPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const { setActiveSpace, reload: reloadSpaceCtx } = useSpace();
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadSpaces() {
    if (!activeWorkspace) return;
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<Space[]>(`/workspaces/${activeWorkspace.id}/spaces`);
      setSpaces(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading || !activeWorkspace) return;
    setLoading(true);
    void loadSpaces();
  }, [activeWorkspace, wsLoading]);

  async function handleCreate() {
    if (!activeWorkspace || !name.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const space = await api.post<Space>(`/workspaces/${activeWorkspace.id}/spaces`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setSpaces((prev) => [...prev, space]);
      reloadSpaceCtx();
      setDialogOpen(false);
      setName('');
      setDescription('');
      setActiveSpace(space);
      router.push(`/spaces/${space.id}/workflows`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Spaces</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New space
        </Button>
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : spaces.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No spaces yet. Create one to get started.</p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>Create space</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => {
                setActiveSpace(space);
                router.push(`/spaces/${space.id}/workflows`);
              }}
              className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium">{space.name}</p>
              {space.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{space.description}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Created {new Date(space.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create space</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="space-name">Name</Label>
              <Input
                id="space-name"
                placeholder="My space"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="space-desc">Description (optional)</Label>
              <Input
                id="space-desc"
                placeholder="What's this space for?"
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
