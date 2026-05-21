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
import { Badge } from '@linea/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  LayoutLeftIcon,
  Add01Icon,
  MoreVerticalIcon,
  Edit01Icon,
  Delete01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
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

const PALETTE = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function podColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

function PodCard({
  pod,
  onOpen,
  onEdit,
  onDelete,
}: {
  pod: Pod;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = podColor(pod.id);
  const initials = pod.name.slice(0, 2).toUpperCase();

  return (
    <div
      className="group relative flex flex-col rounded-xl border border-border bg-card hover:border-border/80 hover:shadow-sm transition-all duration-150 cursor-pointer overflow-hidden"
      onClick={onOpen}
    >
      {/* Colored top strip */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: color }} />

      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold select-none"
              style={{ backgroundColor: color }}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate leading-tight">{pod.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{pod.slug}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>
                <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <HugeiconsIcon icon={Delete01Icon} className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {pod.description ? (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{pod.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">No description</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className="text-[11px] text-muted-foreground">
            Created {new Date(pod.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Open <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PodsPage() {
  const { getToken } = useAuth();
  const { workspaces, activeWorkspace, addWorkspace, loading: wsLoading } = useWorkspace();
  const { setActivePod, reload: reloadPodCtx } = usePod();
  const router = useRouter();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);

  const [podDialogOpen, setPodDialogOpen] = useState(false);
  const [podName, setPodName] = useState('');
  const [podDesc, setPodDesc] = useState('');
  const [creatingPod, setCreatingPod] = useState(false);

  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

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
  }, [activeWorkspace, wsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (wsLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
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
        <Dialog open={wsDialogOpen} onOpenChange={setWsDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create workspace</DialogTitle></DialogHeader>
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Pods</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Isolated environments that group your workflows, executions, and schedules.
          </p>
        </div>
        <Button size="sm" onClick={() => setPodDialogOpen(true)} className="shrink-0">
          <HugeiconsIcon icon={Add01Icon} />
          New pod
        </Button>
      </div>

      {pods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
            <HugeiconsIcon icon={LayoutLeftIcon} className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No pods yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Pods group your workflows, executions, and schedules together in an isolated environment.
          </p>
          <Button size="sm" className="mt-5" onClick={() => setPodDialogOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} />
            Create pod
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pods.map((pod) => (
            <PodCard
              key={pod.id}
              pod={pod}
              onOpen={() => { setActivePod(pod); router.push(`/pods/${pod.id}/workflows`); }}
              onEdit={() => { setEditPod(pod); setEditName(pod.name); setEditDesc(pod.description ?? ''); }}
              onDelete={() => setDeletePod(pod)}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editPod} onOpenChange={(o) => { if (!o) setEditPod(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit pod</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="What's this pod for?" />
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

      {/* Delete confirm */}
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

      {/* Create dialog */}
      <Dialog open={podDialogOpen} onOpenChange={setPodDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create pod</DialogTitle></DialogHeader>
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
