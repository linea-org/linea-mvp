'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { LayoutLeftIcon, Add01Icon, MoreVerticalIcon, Edit01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
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

interface Pod {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export default function PodsPage() {
  const { getToken } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace, addWorkspace, loading: wsLoading } = useWorkspace();
  const { setActivePod, reload: reloadPodCtx } = usePod();
  const router = useRouter();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);

  // Pod dialog
  const [podDialogOpen, setPodDialogOpen] = useState(false);
  const [podName, setPodName] = useState('');
  const [podDesc, setPodDesc] = useState('');
  const [creatingPod, setCreatingPod] = useState(false);

  // Workspace dialog
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  // Pod edit/delete
  const [editPod, setEditPod] = useState<Pod | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletePod, setDeletePod] = useState<Pod | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    setLoading(true);
    void loadPods();
  }, [activeWorkspace, wsLoading]);

  async function loadPods() {
    if (!activeWorkspace) return;
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<Pod[]>(`/workspaces/${activeWorkspace.id}/pods`);
      setPods(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!wsName.trim()) return;
    setCreatingWs(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const ws = await api.post<{ id: string; name: string; slug: string; plan: string }>(
        '/workspaces',
        { name: wsName.trim() },
      );
      addWorkspace(ws);
      setWsDialogOpen(false);
      setWsName('');
    } finally {
      setCreatingWs(false);
    }
  }

  async function handleEditPod() {
    if (!activeWorkspace || !editPod || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const updated = await api.patch<Pod>(
        `/workspaces/${activeWorkspace.id}/pods/${editPod.id}`,
        { name: editName.trim(), description: editDesc.trim() || null },
      );
      setPods((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setEditPod(null);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeletePod() {
    if (!activeWorkspace || !deletePod) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/pods/${deletePod.id}`);
      setPods((prev) => prev.filter((p) => p.id !== deletePod.id));
      setDeletePod(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreatePod() {
    if (!activeWorkspace || !podName.trim()) return;
    setCreatingPod(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const pod = await api.post<Pod>(`/workspaces/${activeWorkspace.id}/pods`, {
        name: podName.trim(),
        description: podDesc.trim() || undefined,
      });
      setPods((prev) => [...prev, pod]);
      reloadPodCtx();
      setPodDialogOpen(false);
      setPodName('');
      setPodDesc('');
      setActivePod(pod);
      router.push(`/pods/${pod.id}/workflows`);
    } finally {
      setCreatingPod(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (wsLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  // ── No workspace ───────────────────────────────────────────────────────────
  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <HugeiconsIcon icon={LayoutLeftIcon} className="size-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-base">No workspace yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            {workspaces.length === 0
              ? 'Create your first workspace to start building AI workflows.'
              : 'Select a workspace from the sidebar to continue.'}
          </p>
        </div>
        {workspaces.length === 0 && (
          <Button onClick={() => setWsDialogOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} />
            Create workspace
          </Button>
        )}

        {/* Workspace creation dialog */}
        <Dialog open={wsDialogOpen} onOpenChange={setWsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5 py-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                placeholder="My company"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateWorkspace(); }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWsDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleCreateWorkspace()} disabled={!wsName.trim() || creatingWs}>
                {creatingWs ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── No pods ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pods</h1>
        <Button size="sm" onClick={() => setPodDialogOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} />
          New pod
        </Button>
      </div>

      {pods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HugeiconsIcon icon={LayoutLeftIcon} className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No pods yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pods group your workflows, executions, and schedules together.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setPodDialogOpen(true)}>
            Create pod
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pods.map((pod) => (
            <div
              key={pod.id}
              className="group relative rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <button
                className="absolute inset-0 rounded-lg"
                onClick={() => { setActivePod(pod); router.push(`/pods/${pod.id}/workflows`); }}
                aria-label={`Open ${pod.name}`}
              />
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{pod.name}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="relative z-10 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HugeiconsIcon icon={MoreVerticalIcon} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditPod(pod); setEditName(pod.name); setEditDesc(pod.description ?? ''); }}>
                      <HugeiconsIcon icon={Edit01Icon} className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeletePod(pod)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {pod.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{pod.description}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Created {new Date(pod.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pod edit dialog */}
      <Dialog open={!!editPod} onOpenChange={(o) => { if (!o) setEditPod(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit pod</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="What's this pod for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPod(null)}>Cancel</Button>
            <Button onClick={() => void handleEditPod()} disabled={!editName.trim() || savingEdit}>
              {savingEdit ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pod delete confirm */}
      <AlertDialog open={!!deletePod} onOpenChange={(o) => { if (!o) setDeletePod(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deletePod?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the pod and all its workflows, executions, schedules, and webhooks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeletePod()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete pod'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pod creation dialog */}
      <Dialog open={podDialogOpen} onOpenChange={setPodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create pod</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pod-name">Name</Label>
              <Input
                id="pod-name"
                placeholder="My pod"
                value={podName}
                onChange={(e) => setPodName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreatePod(); }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pod-desc">Description (optional)</Label>
              <Input
                id="pod-desc"
                placeholder="What's this pod for?"
                value={podDesc}
                onChange={(e) => setPodDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPodDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreatePod()} disabled={!podName.trim() || creatingPod}>
              {creatingPod ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
