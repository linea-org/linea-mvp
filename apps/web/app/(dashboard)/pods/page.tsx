"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { usePod } from "@/contexts/space-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
=======
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@linea/ui/components/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LayoutLeftIcon,
  Add01Icon,
  MoreVerticalIcon,
  Edit01Icon,
  Delete01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@linea/ui/components/dropdown-menu"
interface Pod {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: string
}

const PALETTE = [
  "#6366f1",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
]

function podColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return PALETTE[Math.abs(h) % PALETTE.length]!
}

function PodCard({
  pod,
  onOpen,
  onEdit,
  onDelete,
}: {
  pod: Pod
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const color = podColor(pod.id)
  const initials = pod.name.slice(0, 2).toUpperCase()

  return (
    <div
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-150 hover:border-border/80 hover:shadow-sm"
      onClick={onOpen}
    >
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: color }} />

<<<<<<< HEAD
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header row */}
=======
      <div className="flex flex-col gap-3 p-4 flex-1">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white select-none"
              style={{ backgroundColor: color }}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm leading-tight font-semibold text-foreground">
                {pod.name}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {pod.slug}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
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

        {pod.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {pod.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">
            No description
          </p>
        )}

<<<<<<< HEAD
        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-1">
=======
        <div className="flex items-center justify-between mt-auto pt-1">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
          <p className="text-[11px] text-muted-foreground">
            Created{" "}
            {new Date(pod.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            Open <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PodsPage() {
<<<<<<< HEAD
  const { getToken } = useAuth()
  const {
    workspaces,
    activeWorkspace,
    addWorkspace,
    loading: wsLoading,
  } = useWorkspace()
  const { setActivePod, reload: reloadPodCtx } = usePod()
  const router = useRouter()

  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(true)

  const [podDialogOpen, setPodDialogOpen] = useState(false)
  const [podName, setPodName] = useState("")
  const [podDesc, setPodDesc] = useState("")
  const [creatingPod, setCreatingPod] = useState(false)

  const [wsDialogOpen, setWsDialogOpen] = useState(false)
  const [wsName, setWsName] = useState("")
  const [creatingWs, setCreatingWs] = useState(false)

  const [editPod, setEditPod] = useState<Pod | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletePod, setDeletePod] = useState<Pod | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (wsLoading) return
    if (!activeWorkspace) {
      setLoading(false)
      return
    }
    setLoading(true)
    void loadPods()
  }, [activeWorkspace, wsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPods() {
    if (!activeWorkspace) return
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const data = await api.get<Pod[]>(
        `/workspaces/${activeWorkspace.id}/pods`
      )
      setPods(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateWorkspace() {
    if (!wsName.trim()) return
    setCreatingWs(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const ws = await api.post<{
        id: string
        name: string
        slug: string
        plan: string
      }>("/workspaces", { name: wsName.trim() })
      addWorkspace(ws)
      setWsDialogOpen(false)
      setWsName("")
    } finally {
      setCreatingWs(false)
    }
  }

  async function handleEditPod() {
    if (!activeWorkspace || !editPod || !editName.trim()) return
    setSavingEdit(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const updated = await api.patch<Pod>(
        `/workspaces/${activeWorkspace.id}/pods/${editPod.id}`,
        { name: editName.trim(), description: editDesc.trim() || null }
      )
      setPods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setEditPod(null)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeletePod() {
    if (!activeWorkspace || !deletePod) return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.delete(`/workspaces/${activeWorkspace.id}/pods/${deletePod.id}`)
      setPods((prev) => prev.filter((p) => p.id !== deletePod.id))
      setDeletePod(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreatePod() {
    if (!activeWorkspace || !podName.trim()) return
    setCreatingPod(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const pod = await api.post<Pod>(
        `/workspaces/${activeWorkspace.id}/pods`,
        {
          name: podName.trim(),
          description: podDesc.trim() || undefined,
        }
      )
      setPods((prev) => [...prev, pod])
      reloadPodCtx()
      setPodDialogOpen(false)
      setPodName("")
      setPodDesc("")
      setActivePod(pod)
      router.push(`/pods/${pod.id}/workflows`)
    } finally {
      setCreatingPod(false)
    }
  }
=======
  const getApi = useApiClient();
  const { workspaces, activeWorkspace, addWorkspace, loading: wsLoading } = useWorkspace();
  const { setActivePod, reload: reloadPodCtx } = usePod();
  const router = useRouter();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';

  const [podDialogOpen, setPodDialogOpen] = useState(false);
  const [podName, setPodName] = useState('');
  const [podDesc, setPodDesc] = useState('');

  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [wsName, setWsName] = useState('');

  const [editPod, setEditPod] = useState<Pod | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deletePod, setDeletePod] = useState<Pod | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: pods = [], isLoading: loading } = useQuery<Pod[]>({
    queryKey: ['pods', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<Pod[]>(`/workspaces/${wsId}/pods`);
    },
  });

  const createWorkspace = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<{ id: string; name: string; slug: string; plan: string }>('/workspaces', { name: wsName.trim() });
    },
    onSuccess: (ws) => {
      addWorkspace(ws);
      setWsDialogOpen(false);
      setWsName('');
    },
  });

  const editPodMutation = useMutation({
    mutationFn: async () => {
      if (!editPod) throw new Error('No pod selected');
      const api = await getApi();
      return api.patch<Pod>(`/workspaces/${wsId}/pods/${editPod.id}`, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Pod[]>(['pods', wsId], (prev = []) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditPod(null);
    },
  });

  const deletePodMutation = useMutation({
    mutationFn: async () => {
      if (!deletePod) throw new Error('No pod selected');
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/pods/${deletePod.id}`);
      return deletePod.id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Pod[]>(['pods', wsId], (prev = []) => prev.filter((p) => p.id !== id));
      setDeletePod(null);
    },
  });

  const createPod = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<Pod>(`/workspaces/${wsId}/pods`, {
        name: podName.trim(),
        description: podDesc.trim() || undefined,
      });
    },
    onSuccess: (pod) => {
      queryClient.setQueryData<Pod[]>(['pods', wsId], (prev = []) => [...prev, pod]);
      reloadPodCtx();
      setPodDialogOpen(false);
      setPodName('');
      setPodDesc('');
      setActivePod(pod);
      router.push(`/pods/${pod.id}/workflows`);
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  if (wsLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <HugeiconsIcon
            icon={LayoutLeftIcon}
            className="size-7 text-muted-foreground"
          />
        </div>
        <div>
          <p className="text-base font-semibold">No workspace yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {workspaces.length === 0
              ? "Create your first workspace to start building AI workflows."
              : "Select a workspace from the sidebar to continue."}
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
<<<<<<< HEAD
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateWorkspace()
                }}
=======
                onKeyDown={(e) => { if (e.key === 'Enter') createWorkspace.mutate(); }}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                autoFocus
              />
            </div>
            <DialogFooter>
<<<<<<< HEAD
              <Button variant="outline" onClick={() => setWsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateWorkspace()}
                disabled={!wsName.trim() || creatingWs}
              >
                {creatingWs ? "Creating…" : "Create"}
=======
              <Button variant="outline" onClick={() => setWsDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createWorkspace.mutate()} disabled={!wsName.trim() || createWorkspace.isPending}>
                {createWorkspace.isPending ? 'Creating…' : 'Create'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Pods</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Isolated environments that group your workflows, executions, and
            schedules.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setPodDialogOpen(true)}
          className="shrink-0"
        >
          <HugeiconsIcon icon={Add01Icon} />
          New pod
        </Button>
      </div>

      {pods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
            <HugeiconsIcon
              icon={LayoutLeftIcon}
              className="size-6 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">No pods yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Pods group your workflows, executions, and schedules together in an
            isolated environment.
          </p>
          <Button
            size="sm"
            className="mt-5"
            onClick={() => setPodDialogOpen(true)}
          >
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
              onOpen={() => {
                setActivePod(pod)
                router.push(`/pods/${pod.id}/workflows`)
              }}
              onEdit={() => {
                setEditPod(pod)
                setEditName(pod.name)
                setEditDesc(pod.description ?? "")
              }}
              onDelete={() => {
                setDeletePod(pod)
                setDeleteConfirmText("")
              }}
            />
          ))}
        </div>
      )}

<<<<<<< HEAD
      {/* Edit dialog */}
      <Dialog
        open={!!editPod}
        onOpenChange={(o) => {
          if (!o) setEditPod(null)
        }}
      >
=======
      <Dialog open={!!editPod} onOpenChange={(o) => { if (!o) setEditPod(null); }}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
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
<<<<<<< HEAD
            <Button variant="outline" onClick={() => setEditPod(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleEditPod()}
              disabled={!editName.trim() || savingEdit}
            >
              {savingEdit ? "Saving…" : "Save"}
=======
            <Button variant="outline" onClick={() => setEditPod(null)}>Cancel</Button>
            <Button onClick={() => editPodMutation.mutate()} disabled={!editName.trim() || editPodMutation.isPending}>
              {editPodMutation.isPending ? 'Saving…' : 'Save'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<<<<<<< HEAD
      {/* Delete confirm — Vercel-style name confirmation */}
      <Dialog
        open={!!deletePod}
        onOpenChange={(o) => {
          if (!deleting && !o) setDeletePod(null)
        }}
      >
=======
      <Dialog open={!!deletePod} onOpenChange={(o) => { if (!deletePodMutation.isPending && !o) setDeletePod(null); }}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete pod</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <strong>Warning:</strong> This will permanently delete{" "}
              <strong>{deletePod?.name}</strong> and all its workflows,
              executions, schedules, and webhooks. There is no way to recover
              this pod.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-pod-confirm" className="text-sm">
                Type{" "}
                <span className="font-mono font-semibold">
                  {deletePod?.name}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id="delete-pod-confirm"
                placeholder={deletePod?.name ?? ""}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => {
<<<<<<< HEAD
                  if (
                    e.key === "Enter" &&
                    deleteConfirmText === deletePod?.name
                  )
                    void handleDeletePod()
=======
                  if (e.key === 'Enter' && deleteConfirmText === deletePod?.name) deletePodMutation.mutate();
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                }}
                autoFocus
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
<<<<<<< HEAD
            <Button
              variant="outline"
              onClick={() => setDeletePod(null)}
              disabled={deleting}
            >
=======
            <Button variant="outline" onClick={() => setDeletePod(null)} disabled={deletePodMutation.isPending}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletePodMutation.mutate()}
              disabled={deleteConfirmText !== deletePod?.name || deletePodMutation.isPending}
            >
<<<<<<< HEAD
              {deleting ? "Deleting…" : "Delete pod"}
=======
              {deletePodMutation.isPending ? 'Deleting…' : 'Delete pod'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
<<<<<<< HEAD
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreatePod()
                }}
=======
                onKeyDown={(e) => { if (e.key === 'Enter') createPod.mutate(); }}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
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
<<<<<<< HEAD
            <Button variant="outline" onClick={() => setPodDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreatePod()}
              disabled={!podName.trim() || creatingPod}
            >
              {creatingPod ? "Creating…" : "Create"}
=======
            <Button variant="outline" onClick={() => setPodDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createPod.mutate()} disabled={!podName.trim() || createPod.isPending}>
              {createPod.isPending ? 'Creating…' : 'Create'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
