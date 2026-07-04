"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Badge } from "@linea/ui/components/badge"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
=======
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApiClient } from '@/hooks/use-api-client';
import { unwrapList } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Badge } from '@linea/ui/components/badge';
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
  DialogDescription,
} from "@linea/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@linea/ui/components/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@linea/ui/components/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreVerticalIcon,
  FavouriteIcon,
  Delete01Icon,
  Undo02Icon,
  WorkflowSquare01Icon,
  Delete02Icon,
  GridViewIcon,
  ArrowUp01Icon,
  Copy01Icon,
  Search01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

interface Workflow {
  id: string
  name: string
  description: string | null
  deployedAt: string | null
  isTemplate: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface TemplateOption {
  id: string
  name: string
  description: string | null
  category: string
  source: string
}

type ViewMode = "active" | "favorites" | "pod-templates" | "trash"
type CreateStep = "choice" | "name"

const CATEGORIES = [
  "Productivity",
  "Communication",
  "Data",
  "DevOps",
  "Automation",
  "Marketing",
]

const CATEGORY_COLORS: Record<string, string> = {
  Productivity:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Communication:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Data: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DevOps:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Automation:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  AI: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Content: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  Research: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Sales:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Safety: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Analytics:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
}

export default function WorkflowsPage() {
<<<<<<< HEAD
  const { podId } = useParams<{ podId: string }>()
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const router = useRouter()

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>("active")

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>("choice")
  const [createMode, setCreateMode] = useState<"blank" | "template">("blank")
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)

  // Template picker state
  const [pickedTemplate, setPickedTemplate] = useState<TemplateOption | null>(
    null
  )
  const [templateSearch, setTemplateSearch] = useState("")
  const [templateList, setTemplateList] = useState<TemplateOption[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Publish to gallery state
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishTarget, setPublishTarget] = useState<Workflow | null>(null)
  const [publishName, setPublishName] = useState("")
  const [publishDesc, setPublishDesc] = useState("")
  const [publishCategory, setPublishCategory] = useState("")
  const [publishFeatured, setPublishFeatured] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // Permanent delete confirm state
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Workflow | null>(
    null
  )
  const [hardDeleting, setHardDeleting] = useState(false)

  async function load(mode: ViewMode = view) {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const params = new URLSearchParams()
      if (mode === "trash") params.set("trashed", "true")
      if (mode === "favorites") params.set("favorited", "true")
      if (mode === "pod-templates") params.set("isTemplate", "true")
      const [data, favIds] = await Promise.all([
        api.get<{ workflows: Workflow[]; meta?: unknown }>(
          `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows?${params}`
        ),
        api
          .get<
            string[]
          >(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/me/favorites`)
          .catch(() => [] as string[]),
      ])
      setWorkflows(Array.isArray(data) ? data : (data?.workflows ?? []))
      setFavoriteIds(new Set(favIds))
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplates() {
    const token = await getToken()
    if (!token) return
    setLoadingTemplates(true)
    try {
      const api = createApiClient(token)
      const rows = await api.get<TemplateOption[]>("/templates")
      setTemplateList(rows)
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    if (!wsLoading && activeWorkspace) void load(view)
  }, [activeWorkspace, wsLoading, podId, view])

  function openCreateDialog() {
    setCreateOpen(true)
    setCreateStep("choice")
    setCreateMode("blank")
    setPickedTemplate(null)
    setNewName("")
    setNewDesc("")
    setTemplateSearch("")
    void loadTemplates()
=======
  const { podId } = useParams<{ podId: string }>();
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';

  const [view, setView] = useState<ViewMode>('active');

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>('choice');
  const [createMode, setCreateMode] = useState<'blank' | 'template'>('blank');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Template picker state
  const [pickedTemplate, setPickedTemplate] = useState<TemplateOption | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');

  // Publish to gallery state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<Workflow | null>(null);
  const [publishName, setPublishName] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishCategory, setPublishCategory] = useState('');
  const [publishFeatured, setPublishFeatured] = useState(false);

  // Permanent delete confirm state
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Workflow | null>(null);

  const workflowsKey = ['pod-workflows', wsId, podId, view];

  const { data: workflows = [], isLoading: loading } = useQuery<Workflow[]>({
    queryKey: workflowsKey,
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      const params = new URLSearchParams();
      if (view === 'trash') params.set('trashed', 'true');
      if (view === 'favorites') params.set('favorited', 'true');
      if (view === 'pod-templates') params.set('isTemplate', 'true');
      const data = await api.get<Workflow[] | { workflows: Workflow[]; meta?: unknown }>(
        `/workspaces/${wsId}/pods/${podId}/workflows?${params}`,
      );
      return unwrapList(data, 'workflows');
    },
  });

  const { data: favoriteIds = new Set<string>() } = useQuery<Set<string>>({
    queryKey: ['pod-workflow-favorites', wsId, podId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      const favIds = await api.get<string[]>(`/workspaces/${wsId}/pods/${podId}/workflows/me/favorites`).catch(() => [] as string[]);
      return new Set(favIds);
    },
  });

  const { data: templateList = [], isLoading: loadingTemplates } = useQuery<TemplateOption[]>({
    queryKey: ['templates'],
    enabled: createOpen,
    queryFn: async () => {
      const api = await getApi();
      return api.get<TemplateOption[]>('/templates');
    },
  });

  function openCreateDialog() {
    setCreateOpen(true);
    setCreateStep('choice');
    setCreateMode('blank');
    setPickedTemplate(null);
    setNewName('');
    setNewDesc('');
    setTemplateSearch('');
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
  }

  function resetCreateDialog() {
    setCreateStep("choice")
    setCreateMode("blank")
    setPickedTemplate(null)
    setNewName("")
    setNewDesc("")
    setTemplateSearch("")
  }

<<<<<<< HEAD
  async function toggleFavorite(wfId: string) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    const isFav = favoriteIds.has(wfId)

    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(wfId)
      else next.add(wfId)
      return next
    })

    try {
      if (isFav) {
        await api.delete(
          `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wfId}/favorite`
        )
      } else {
        await api.post(
          `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wfId}/favorite`,
          {}
        )
      }
      if (view === "favorites") {
        setWorkflows((prev) =>
          isFav ? prev.filter((w) => w.id !== wfId) : prev
        )
      }
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (isFav) next.add(wfId)
        else next.delete(wfId)
        return next
      })
    }
  }

  async function toggleTemplate(wf: Workflow) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    const updated = await api.patch<Workflow>(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wf.id}/template`,
      { isTemplate: !wf.isTemplate }
    )
    setWorkflows((prev) =>
      prev
        .map((w) => (w.id === wf.id ? updated : w))
        .filter((w) => view !== "pod-templates" || w.isTemplate)
    )
  }

  async function duplicateWorkflow(id: string) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    const copy = await api.post<Workflow>(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${id}/duplicate`,
      {}
    )
    setWorkflows((prev) => [copy, ...prev])
  }

  async function trashWorkflow(id: string) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    await api.patch(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${id}/trash`
    )
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  async function restoreWorkflow(id: string) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    await api.patch(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${id}/restore`
    )
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  async function hardDeleteWorkflow() {
    if (!activeWorkspace || !hardDeleteTarget) return
    setHardDeleting(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.delete(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${hardDeleteTarget.id}/permanent`
      )
      setWorkflows((prev) => prev.filter((w) => w.id !== hardDeleteTarget.id))
      setHardDeleteTarget(null)
    } finally {
      setHardDeleting(false)
    }
  }
=======
  const toggleFavorite = useMutation({
    mutationFn: async (wfId: string) => {
      const api = await getApi();
      const isFav = favoriteIds.has(wfId);
      if (isFav) {
        await api.delete(`/workspaces/${wsId}/pods/${podId}/workflows/${wfId}/favorite`);
      } else {
        await api.post(`/workspaces/${wsId}/pods/${podId}/workflows/${wfId}/favorite`, {});
      }
      return { wfId, isFav };
    },
    onMutate: (wfId) => {
      const isFav = favoriteIds.has(wfId);
      queryClient.setQueryData<Set<string>>(['pod-workflow-favorites', wsId, podId], (prev = new Set()) => {
        const next = new Set(prev);
        if (isFav) next.delete(wfId); else next.add(wfId);
        return next;
      });
      return { isFav };
    },
    onSuccess: ({ wfId, isFav }) => {
      if (view === 'favorites' && isFav) {
        queryClient.setQueryData<Workflow[]>(workflowsKey, (prev = []) => prev.filter((w) => w.id !== wfId));
      }
    },
    onError: (_err, wfId, context) => {
      if (!context) return;
      queryClient.setQueryData<Set<string>>(['pod-workflow-favorites', wsId, podId], (prev = new Set()) => {
        const next = new Set(prev);
        if (context.isFav) next.add(wfId); else next.delete(wfId);
        return next;
      });
    },
  });

  const toggleTemplate = useMutation({
    mutationFn: async (wf: Workflow) => {
      const api = await getApi();
      return api.patch<Workflow>(`/workspaces/${wsId}/pods/${podId}/workflows/${wf.id}/template`, { isTemplate: !wf.isTemplate });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Workflow[]>(workflowsKey, (prev = []) =>
        prev.map((w) => (w.id === updated.id ? updated : w)).filter((w) => view !== 'pod-templates' || w.isTemplate));
    },
  });

  const duplicateWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      return api.post<Workflow>(`/workspaces/${wsId}/pods/${podId}/workflows/${id}/duplicate`, {});
    },
    onSuccess: (copy) => {
      queryClient.setQueryData<Workflow[]>(workflowsKey, (prev = []) => [copy, ...prev]);
    },
  });

  const trashWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.patch(`/workspaces/${wsId}/pods/${podId}/workflows/${id}/trash`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Workflow[]>(workflowsKey, (prev = []) => prev.filter((w) => w.id !== id));
    },
  });

  const restoreWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.patch(`/workspaces/${wsId}/pods/${podId}/workflows/${id}/restore`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Workflow[]>(workflowsKey, (prev = []) => prev.filter((w) => w.id !== id));
    },
  });

  const hardDeleteWorkflow = useMutation({
    mutationFn: async () => {
      if (!hardDeleteTarget) throw new Error('No target selected');
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/pods/${podId}/workflows/${hardDeleteTarget.id}/permanent`);
      return hardDeleteTarget.id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Workflow[]>(workflowsKey, (prev = []) => prev.filter((w) => w.id !== id));
      setHardDeleteTarget(null);
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  function openPublishDialog(wf: Workflow) {
    setPublishTarget(wf)
    setPublishName(wf.name)
    setPublishDesc(wf.description ?? "")
    setPublishCategory("")
    setPublishFeatured(false)
    setPublishOpen(true)
  }

<<<<<<< HEAD
  async function handlePublish() {
    if (!activeWorkspace || !publishTarget || !publishCategory) return
    setPublishing(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.post(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${publishTarget.id}/publish`,
        {
          name: publishName || undefined,
          description: publishDesc || undefined,
          category: publishCategory,
          featured: publishFeatured,
        }
      )
      setPublishOpen(false)
    } finally {
      setPublishing(false)
    }
  }

  async function handleCreate() {
    if (!activeWorkspace || !newName.trim()) return
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const wf = await api.post<Workflow>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows`,
        { name: newName.trim(), description: newDesc.trim() || undefined }
      )
      localStorage.setItem("linea_gs_workflow", "true")
      setCreateOpen(false)
      resetCreateDialog()
      router.push(`/pods/${podId}/workflows/${wf.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateFromTemplate() {
    if (!activeWorkspace || !pickedTemplate || !newName.trim()) return
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const wf = await api.post<Workflow>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/from-template/${pickedTemplate.id}`,
        { name: newName.trim() }
      )
      localStorage.setItem("linea_gs_workflow", "true")
      setCreateOpen(false)
      resetCreateDialog()
      router.push(`/pods/${podId}/workflows/${wf.id}`)
    } finally {
      setCreating(false)
    }
  }
=======
  const publishWorkflow = useMutation({
    mutationFn: async () => {
      if (!publishTarget || !publishCategory) throw new Error('Missing publish details');
      const api = await getApi();
      await api.post(`/workspaces/${wsId}/pods/${podId}/workflows/${publishTarget.id}/publish`, {
        name: publishName || undefined,
        description: publishDesc || undefined,
        category: publishCategory,
        featured: publishFeatured,
      });
    },
    onSuccess: () => setPublishOpen(false),
  });

  const createWorkflow = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<Workflow>(`/workspaces/${wsId}/pods/${podId}/workflows`, {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
    },
    onSuccess: (wf) => {
      localStorage.setItem('linea_gs_workflow', 'true');
      setCreateOpen(false);
      resetCreateDialog();
      router.push(`/pods/${podId}/workflows/${wf.id}`);
    },
  });

  const createFromTemplate = useMutation({
    mutationFn: async () => {
      if (!pickedTemplate) throw new Error('No template selected');
      const api = await getApi();
      return api.post<Workflow>(`/workspaces/${wsId}/pods/${podId}/workflows/from-template/${pickedTemplate.id}`, {
        name: newName.trim(),
      });
    },
    onSuccess: (wf) => {
      localStorage.setItem('linea_gs_workflow', 'true');
      setCreateOpen(false);
      resetCreateDialog();
      router.push(`/pods/${podId}/workflows/${wf.id}`);
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: "active", label: "All" },
    { key: "favorites", label: "Favorites" },
    { key: "pod-templates", label: "Pod templates" },
    { key: "trash", label: "Trash" },
  ]

  const emptyMessages: Record<ViewMode, { title: string; sub: string }> = {
    active: {
      title: "No workflows yet",
      sub: "Create your first workflow to start automating with AI nodes.",
    },
    favorites: {
      title: "No favorites yet",
      sub: "Favorite workflows to find them quickly here — favorites are personal to you.",
    },
    "pod-templates": {
      title: "No pod templates",
      sub: "Mark a workflow as a pod template so it appears here for easy cloning.",
    },
    trash: {
      title: "Trash is empty",
      sub: "Workflows you delete will appear here before permanent removal.",
    },
  }

  const filteredTemplateList = templateList.filter(
    (t) =>
      !templateSearch ||
      t.name.toLowerCase().includes(templateSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <Button onClick={openCreateDialog}>New workflow</Button>
      </div>

      <div className="flex gap-1">
        {viewTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={[
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              view === key
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon
              icon={
                view === "trash"
                  ? Delete02Icon
                  : view === "favorites"
                    ? FavouriteIcon
                    : view === "pod-templates"
                      ? GridViewIcon
                      : WorkflowSquare01Icon
              }
              className="size-6 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">{emptyMessages[view].title}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {emptyMessages[view].sub}
          </p>
          {view === "active" && (
            <Button size="sm" className="mt-5" onClick={openCreateDialog}>
              New workflow
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((wf) => (
              <TableRow key={wf.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {favoriteIds.has(wf.id) && (
                      <HugeiconsIcon
                        icon={FavouriteIcon}
                        className="size-3.5 shrink-0 text-yellow-500"
                        style={{ fill: "currentColor" }}
                      />
                    )}
                    <div>
                      <p className="font-medium">{wf.name}</p>
                      {wf.description && (
                        <p className="text-xs text-muted-foreground">
                          {wf.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={wf.deployedAt ? "default" : "secondary"}>
                      {wf.deletedAt
                        ? "trashed"
                        : wf.deployedAt
                          ? "deployed"
                          : "draft"}
                    </Badge>
                    {wf.isTemplate && !wf.deletedAt && (
                      <Badge variant="outline" className="text-[10px]">
                        template
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(wf.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {view !== "trash" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/pods/${podId}/workflows/${wf.id}`}>
                          Open builder
                        </Link>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0"
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalIcon}
                            className="size-4"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {view !== "trash" && (
                          <>
<<<<<<< HEAD
                            <DropdownMenuItem
                              onClick={() => void toggleFavorite(wf.id)}
                            >
                              <HugeiconsIcon
                                icon={FavouriteIcon}
                                className="mr-2 size-4"
                              />
                              {favoriteIds.has(wf.id)
                                ? "Remove from favorites"
                                : "Add to favorites"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void toggleTemplate(wf)}
                            >
                              <HugeiconsIcon
                                icon={GridViewIcon}
                                className="mr-2 size-4"
                              />
                              {wf.isTemplate
                                ? "Remove pod template"
                                : "Mark as pod template"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void duplicateWorkflow(wf.id)}
                            >
                              <HugeiconsIcon
                                icon={Copy01Icon}
                                className="mr-2 size-4"
                              />
=======
                            <DropdownMenuItem onClick={() => toggleFavorite.mutate(wf.id)}>
                              <HugeiconsIcon icon={FavouriteIcon} className="mr-2 size-4" />
                              {favoriteIds.has(wf.id) ? 'Remove from favorites' : 'Add to favorites'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleTemplate.mutate(wf)}>
                              <HugeiconsIcon icon={GridViewIcon} className="mr-2 size-4" />
                              {wf.isTemplate ? 'Remove pod template' : 'Mark as pod template'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateWorkflow.mutate(wf.id)}>
                              <HugeiconsIcon icon={Copy01Icon} className="mr-2 size-4" />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openPublishDialog(wf)}
                            >
                              <HugeiconsIcon
                                icon={ArrowUp01Icon}
                                className="mr-2 size-4"
                              />
                              Publish to gallery
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => trashWorkflow.mutate(wf.id)}
                            >
                              <HugeiconsIcon
                                icon={Delete01Icon}
                                className="mr-2 size-4"
                              />
                              Move to trash
                            </DropdownMenuItem>
                          </>
                        )}
                        {view === "trash" && (
                          <>
<<<<<<< HEAD
                            <DropdownMenuItem
                              onClick={() => void restoreWorkflow(wf.id)}
                            >
                              <HugeiconsIcon
                                icon={Undo02Icon}
                                className="mr-2 size-4"
                              />
=======
                            <DropdownMenuItem onClick={() => restoreWorkflow.mutate(wf.id)}>
                              <HugeiconsIcon icon={Undo02Icon} className="mr-2 size-4" />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setHardDeleteTarget(wf)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                className="mr-2 size-4"
                              />
                              Delete permanently
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) resetCreateDialog()
        }}
      >
        <DialogContent
          className={createStep === "choice" ? "sm:max-w-2xl" : "sm:max-w-md"}
          showCloseButton={false}
        >
          {createStep === "choice" ? (
            <>
              <DialogHeader>
                <DialogTitle>New workflow</DialogTitle>
                <DialogDescription>
                  Start blank or pick a template to get going faster.
                </DialogDescription>
              </DialogHeader>

              <button
                className="group flex w-full items-center gap-3 rounded-lg border-2 border-dashed p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                onClick={() => {
                  setCreateMode("blank")
                  setNewName("")
                  setNewDesc("")
                  setCreateStep("name")
                }}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-background">
                  <HugeiconsIcon
                    icon={Add01Icon}
                    className="size-5 text-muted-foreground"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">New blank workflow</p>
                  <p className="text-xs text-muted-foreground">
                    Start with an empty canvas and build from scratch
                  </p>
                </div>
              </button>

<<<<<<< HEAD
              {/* Divider */}
              <div className="my-1 flex items-center gap-3">
=======
              <div className="flex items-center gap-3 my-1">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  or start from a template
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {loadingTemplates ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : filteredTemplateList.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {templateSearch
                    ? "No templates match your search."
                    : "No templates available."}
                </p>
              ) : (
                <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {filteredTemplateList.map((tpl) => (
                    <button
                      key={tpl.id}
                      className="rounded-lg border p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/50"
                      onClick={() => {
                        setPickedTemplate(tpl)
                        setNewName(tpl.name)
                        setCreateMode("template")
                        setCreateStep("name")
                      }}
                    >
                      <div className="mb-1 flex items-start justify-between gap-1.5">
                        <p className="flex-1 truncate text-xs leading-snug font-medium">
                          {tpl.name}
                        </p>
                        {tpl.source === "internal" && (
                          <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                            Built-in
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="mb-1.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {tpl.description}
                        </p>
                      )}
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CATEGORY_COLORS[tpl.category] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {tpl.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <DialogHeader>
                <button
                  className="mb-1 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setCreateStep("choice")
                    setPickedTemplate(null)
                    setNewName("")
                  }}
                >
                  ← Back
                </button>
                <DialogTitle>
                  {createMode === "template"
                    ? "Name your workflow"
                    : "New blank workflow"}
                </DialogTitle>
                {createMode === "template" && pickedTemplate && (
                  <DialogDescription>
                    Starting from "{pickedTemplate.name}"
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    placeholder={
                      pickedTemplate?.name ?? "e.g. Lead scoring pipeline"
                    }
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
<<<<<<< HEAD
                      if (e.key === "Enter") {
                        void (createMode === "template"
                          ? handleCreateFromTemplate()
                          : handleCreate())
=======
                      if (e.key === 'Enter') {
                        (createMode === 'template' ? createFromTemplate : createWorkflow).mutate();
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                      }
                    }}
                    autoFocus
                  />
                </div>
                {createMode === "blank" && (
                  <div className="space-y-1.5">
                    <Label>
                      Description{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      placeholder="What does this workflow do?"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
<<<<<<< HEAD
                  onClick={() =>
                    void (createMode === "template"
                      ? handleCreateFromTemplate()
                      : handleCreate())
                  }
                  disabled={!newName.trim() || creating}
                >
                  {creating ? "Creating…" : "Create & open builder"}
=======
                  onClick={() => (createMode === 'template' ? createFromTemplate : createWorkflow).mutate()}
                  disabled={!newName.trim() || createWorkflow.isPending || createFromTemplate.isPending}
                >
                  {createWorkflow.isPending || createFromTemplate.isPending ? 'Creating…' : 'Create & open builder'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish to gallery</DialogTitle>
            <DialogDescription>
              This workflow will be added to the public template gallery and
              available to all users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={publishDesc}
                onChange={(e) => setPublishDesc(e.target.value)}
                placeholder="Describe what this template does"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={publishCategory}
                onValueChange={setPublishCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publishFeatured}
                onChange={(e) => setPublishFeatured(e.target.checked)}
                className="rounded"
              />
              Mark as featured
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!publishName.trim() || !publishCategory || publishWorkflow.isPending}
              onClick={() => publishWorkflow.mutate()}
            >
<<<<<<< HEAD
              {publishing ? "Publishing…" : "Publish"}
=======
              {publishWorkflow.isPending ? 'Publishing…' : 'Publish'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<<<<<<< HEAD
      {/* Permanent delete confirm */}
      <Dialog
        open={!!hardDeleteTarget}
        onOpenChange={(o) => {
          if (!o) setHardDeleteTarget(null)
        }}
      >
=======
      <Dialog open={!!hardDeleteTarget} onOpenChange={(o) => { if (!o) setHardDeleteTarget(null); }}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete permanently?</DialogTitle>
            <DialogDescription>
              <strong>{hardDeleteTarget?.name}</strong> will be permanently
              deleted and cannot be recovered. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={hardDeleteWorkflow.isPending}
              onClick={() => hardDeleteWorkflow.mutate()}
            >
<<<<<<< HEAD
              {hardDeleting ? "Deleting…" : "Delete permanently"}
=======
              {hardDeleteWorkflow.isPending ? 'Deleting…' : 'Delete permanently'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
