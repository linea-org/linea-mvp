'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { Skeleton } from '@linea/ui/components/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@linea/ui/components/alert-dialog';

export default function GeneralSettingsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading, setActiveWorkspace, workspaces } = useWorkspace();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name);
      setSlug(activeWorkspace.slug);
    }
  }, [activeWorkspace]);

  async function handleSave() {
    if (!activeWorkspace) return;
    setSaving(true);
    setSaved(false);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/workspaces/${activeWorkspace.id}`, { name, slug });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeWorkspace) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}`);
      // Switch to another workspace or clear
      const remaining = workspaces.filter((w) => w.id !== activeWorkspace.id);
      setActiveWorkspace(remaining[0] ?? null as never);
      window.location.href = '/pods';
    } finally {
      setDeleting(false);
    }
  }

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
        <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <p className="text-sm text-green-600">Saved!</p>}
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
        <div>
          <p className="text-sm font-semibold text-destructive">Danger zone</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently delete this workspace, including all pods, workflows, executions, and data. This cannot be undone.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
          Delete workspace
        </Button>
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{activeWorkspace?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workspace and everything inside it — pods, workflows, executions, secrets, API keys, and all team data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Yes, delete workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
