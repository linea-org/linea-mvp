"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Skeleton } from "@linea/ui/components/skeleton"
=======
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';
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
  Add01Icon,
  Database01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  entryCount: number
  updatedAt: string
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

function kbColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return PALETTE[Math.abs(h) % PALETTE.length]!
}

export default function KnowledgePage() {
<<<<<<< HEAD
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const router = useRouter()
  const [bases, setBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)

  async function load() {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const data = await api.get<KnowledgeBase[]>(
        `/workspaces/${activeWorkspace.id}/knowledge-bases`
      )
      setBases(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (wsLoading) return
    if (!activeWorkspace) {
      setLoading(false)
      return
    }
    void load()
  }, [activeWorkspace, wsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!activeWorkspace || !name.trim()) return
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const kb = await api.post<KnowledgeBase>(
        `/workspaces/${activeWorkspace.id}/knowledge-bases`,
        {
          name: name.trim(),
          description: description.trim() || undefined,
        }
      )
      setBases((prev) => [{ ...kb, entryCount: 0 }, ...prev])
      setDialogOpen(false)
      setName("")
      setDescription("")
      router.push(`/knowledge/${kb.id}`)
    } finally {
      setCreating(false)
    }
  }
=======
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: bases = [], isLoading: loading } = useQuery<KnowledgeBase[]>({
    queryKey: ['knowledge-bases', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<KnowledgeBase[]>(`/workspaces/${wsId}/knowledge-bases`);
    },
  });

  const createKb = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<KnowledgeBase>(`/workspaces/${wsId}/knowledge-bases`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
    },
    onSuccess: (kb) => {
      queryClient.setQueryData<KnowledgeBase[]>(['knowledge-bases', wsId], (prev = []) => [{ ...kb, entryCount: 0 }, ...prev]);
      setDialogOpen(false);
      setName('');
      setDescription('');
      router.push(`/knowledge/${kb.id}`);
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Knowledge Bases</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Workspace-wide document collections for RAG retrieval across your
            workflows.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="shrink-0"
        >
          <HugeiconsIcon icon={Add01Icon} />
          New knowledge base
        </Button>
      </div>

      {loading || wsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : bases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
            <HugeiconsIcon
              icon={Database01Icon}
              className="size-6 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">No knowledge bases yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Create a knowledge base to store documents, facts, and content that
            your agents can retrieve at runtime.
          </p>
          <Button
            size="sm"
            className="mt-5"
            onClick={() => setDialogOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} />
            Create knowledge base
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bases.map((kb) => {
            const color = kbColor(kb.id)
            const initials = kb.name.slice(0, 2).toUpperCase()
            return (
              <div
                key={kb.id}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-150 hover:border-border/80 hover:shadow-sm"
                onClick={() => router.push(`/knowledge/${kb.id}`)}
              >
                <div
                  className="h-1 w-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white select-none"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {kb.name}
                    </p>
                  </div>

                  {kb.description ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {kb.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 italic">
                      No description
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      {kb.entryCount}{" "}
                      {kb.entryCount === 1 ? "entry" : "entries"} ·{" "}
                      {new Date(kb.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      Open{" "}
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-3"
                      />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
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
<<<<<<< HEAD
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate()
                }}
=======
                onKeyDown={(e) => { if (e.key === 'Enter') createKb.mutate(); }}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                autoFocus
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
<<<<<<< HEAD
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!name.trim() || creating}
            >
              {creating ? "Creating…" : "Create"}
=======
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createKb.mutate()} disabled={!name.trim() || createKb.isPending}>
              {createKb.isPending ? 'Creating…' : 'Create'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
