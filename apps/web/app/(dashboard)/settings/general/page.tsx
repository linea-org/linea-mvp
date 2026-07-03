'use client';

import { useState } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { useMutation } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { Skeleton } from '@linea/ui/components/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';

export default function GeneralSettingsPage() {
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading, removeWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saved, setSaved] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [syncedWorkspaceId, setSyncedWorkspaceId] = useState(activeWorkspace?.id);
  if (activeWorkspace && activeWorkspace.id !== syncedWorkspaceId) {
    setSyncedWorkspaceId(activeWorkspace.id);
    setName(activeWorkspace.name);
    setSlug(activeWorkspace.slug);
  }

  const saveWorkspace = useMutation({
    mutationFn: async () => {
      if (!activeWorkspace) throw new Error('No active workspace');
      const api = await getApi();
      await api.patch(`/workspaces/${activeWorkspace.id}`, { name, slug });
    },
    onSuccess: () => setSaved(true),
  });

  const deleteWorkspace = useMutation({
    mutationFn: async () => {
      if (!activeWorkspace) throw new Error('No active workspace');
      const api = await getApi();
      await api.delete(`/workspaces/${activeWorkspace.id}`);
      return activeWorkspace.id;
    },
    onSuccess: (id) => {
      removeWorkspace(id);
      window.location.href = '/pods';
    },
  });

  function openDeleteDialog() {
    setDeleteConfirmText('');
    setDeleteOpen(true);
  }

  const deleteConfirmed = deleteConfirmText === activeWorkspace?.name;

  if (wsLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSaved(false); }}
          />
          <p className="text-xs text-muted-foreground">Used in URLs. Only lowercase letters, numbers, and hyphens.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => saveWorkspace.mutate()} disabled={saveWorkspace.isPending || !name.trim()}>
          {saveWorkspace.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <p className="text-sm text-green-600">Saved!</p>}
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3 rounded-lg border border-destructive/40 p-5">
        <div>
          <p className="text-sm font-semibold text-destructive">Delete workspace</p>
          <p className="text-xs text-muted-foreground mt-1">
            Permanently deletes this workspace and everything inside it — pods, workflows,
            executions, secrets, API keys, and all team data. This action{' '}
            <span className="font-medium text-foreground">cannot be undone</span>.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={openDeleteDialog}>
          Delete workspace
        </Button>
      </div>

      {/* Vercel-style delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleteWorkspace.isPending) setDeleteOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <strong>Warning:</strong> This will permanently delete{' '}
              <strong>{activeWorkspace?.name}</strong> and all associated data. There is no
              way to recover this workspace.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm-input" className="text-sm">
                Type <span className="font-mono font-semibold">{activeWorkspace?.name}</span> to confirm
              </Label>
              <Input
                id="delete-confirm-input"
                placeholder={activeWorkspace?.name ?? ''}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirmed) deleteWorkspace.mutate(); }}
                autoFocus
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteWorkspace.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteWorkspace.mutate()}
              disabled={!deleteConfirmed || deleteWorkspace.isPending}
            >
              {deleteWorkspace.isPending ? 'Deleting…' : 'Delete workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
