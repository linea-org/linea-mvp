'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@linea/ui/components/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@linea/ui/components/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import { HugeiconsIcon } from '@hugeicons/react';
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
} from '@hugeicons/core-free-icons';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  deployedAt: string | null;
  isTemplate: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'active' | 'favorites' | 'pod-templates' | 'trash';

const CATEGORIES = ['Productivity', 'Communication', 'Data', 'DevOps', 'Automation', 'Marketing'];

export default function WorkflowsPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Publish to gallery state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<Workflow | null>(null);
  const [publishName, setPublishName] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishCategory, setPublishCategory] = useState('');
  const [publishFeatured, setPublishFeatured] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Permanent delete confirm state
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Workflow | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);

  async function load(mode: ViewMode = view) {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const params = new URLSearchParams();
      if (mode === 'trash') params.set('trashed', 'true');
      if (mode === 'favorites') params.set('favorited', 'true');
      if (mode === 'pod-templates') params.set('isTemplate', 'true');
      const [data, favIds] = await Promise.all([
        api.get<{ workflows: Workflow[]; meta?: unknown }>(
          `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows?${params}`,
        ),
        api.get<string[]>(
          `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/me/favorites`,
        ).catch(() => [] as string[]),
      ]);
      setWorkflows(Array.isArray(data) ? data : (data?.workflows ?? []));
      setFavoriteIds(new Set(favIds));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!wsLoading && activeWorkspace) void load(view);
  }, [activeWorkspace, wsLoading, podId, view]);

  async function toggleFavorite(wfId: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const isFav = favoriteIds.has(wfId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(wfId); else next.add(wfId);
      return next;
    });

    try {
      if (isFav) {
        await api.delete(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wfId}/favorite`);
      } else {
        await api.post(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wfId}/favorite`, {});
      }
      if (view === 'favorites') {
        setWorkflows((prev) => (isFav ? prev.filter((w) => w.id !== wfId) : prev));
      }
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(wfId); else next.delete(wfId);
        return next;
      });
    }
  }

  async function toggleTemplate(wf: Workflow) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const updated = await api.patch<Workflow>(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wf.id}/template`,
      { isTemplate: !wf.isTemplate },
    );
    setWorkflows((prev) =>
      prev
        .map((w) => (w.id === wf.id ? updated : w))
        .filter((w) => view !== 'pod-templates' || w.isTemplate),
    );
  }

  async function duplicateWorkflow(id: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const copy = await api.post<Workflow>(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${id}/duplicate`,
      {},
    );
    setWorkflows((prev) => [copy, ...prev]);
  }

  async function trashWorkflow(id: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    await api.patch(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${id}/trash`);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  }

  async function restoreWorkflow(id: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    await api.patch(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${id}/restore`);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  }

  async function hardDeleteWorkflow() {
    if (!activeWorkspace || !hardDeleteTarget) return;
    setHardDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${hardDeleteTarget.id}/permanent`,
      );
      setWorkflows((prev) => prev.filter((w) => w.id !== hardDeleteTarget.id));
      setHardDeleteTarget(null);
    } finally {
      setHardDeleting(false);
    }
  }

  function openPublishDialog(wf: Workflow) {
    setPublishTarget(wf);
    setPublishName(wf.name);
    setPublishDesc(wf.description ?? '');
    setPublishCategory('');
    setPublishFeatured(false);
    setPublishOpen(true);
  }

  async function handlePublish() {
    if (!activeWorkspace || !publishTarget || !publishCategory) return;
    setPublishing(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.post(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${publishTarget.id}/publish`,
        {
          name: publishName || undefined,
          description: publishDesc || undefined,
          category: publishCategory,
          featured: publishFeatured,
        },
      );
      setPublishOpen(false);
    } finally {
      setPublishing(false);
    }
  }

  async function handleCreate() {
    if (!activeWorkspace || !newName.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const wf = await api.post<Workflow>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows`,
        { name: newName.trim(), description: newDesc.trim() || undefined },
      );
      localStorage.setItem('linea_gs_workflow', 'true');
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      router.push(`/pods/${podId}/workflows/${wf.id}`);
    } finally {
      setCreating(false);
    }
  }

  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'active', label: 'All' },
    { key: 'favorites', label: 'Favorites' },
    { key: 'pod-templates', label: 'Pod templates' },
    { key: 'trash', label: 'Trash' },
  ];

  const emptyMessages: Record<ViewMode, { title: string; sub: string }> = {
    active: { title: 'No workflows yet', sub: 'Create your first workflow to start automating with AI nodes.' },
    favorites: { title: 'No favorites yet', sub: 'Favorite workflows to find them quickly here — favorites are personal to you.' },
    'pod-templates': { title: 'No pod templates', sub: 'Mark a workflow as a pod template so it appears here for easy cloning.' },
    trash: { title: 'Trash is empty', sub: 'Workflows you delete will appear here before permanent removal.' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <Button onClick={() => setCreateOpen(true)}>New workflow</Button>
      </div>

      <div className="flex gap-1">
        {viewTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={[
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              view === key ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon
              icon={
                view === 'trash'
                  ? Delete02Icon
                  : view === 'favorites'
                    ? FavouriteIcon
                    : view === 'pod-templates'
                      ? GridViewIcon
                      : WorkflowSquare01Icon
              }
              className="size-6 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">{emptyMessages[view].title}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{emptyMessages[view].sub}</p>
          {view === 'active' && (
            <Button size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
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
                      <HugeiconsIcon icon={FavouriteIcon} className="size-3.5 text-yellow-500 shrink-0" style={{ fill: 'currentColor' }} />
                    )}
                    <div>
                      <p className="font-medium">{wf.name}</p>
                      {wf.description && (
                        <p className="text-xs text-muted-foreground">{wf.description}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={wf.deployedAt ? 'default' : 'secondary'}>
                      {wf.deletedAt ? 'trashed' : wf.deployedAt ? 'deployed' : 'draft'}
                    </Badge>
                    {wf.isTemplate && !wf.deletedAt && (
                      <Badge variant="outline" className="text-[10px]">template</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(wf.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {view !== 'trash' && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/pods/${podId}/workflows/${wf.id}`}>Open builder</Link>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="size-8 p-0">
                          <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {view !== 'trash' && (
                          <>
                            <DropdownMenuItem onClick={() => void toggleFavorite(wf.id)}>
                              <HugeiconsIcon icon={FavouriteIcon} className="mr-2 size-4" />
                              {favoriteIds.has(wf.id) ? 'Remove from favorites' : 'Add to favorites'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void toggleTemplate(wf)}>
                              <HugeiconsIcon icon={GridViewIcon} className="mr-2 size-4" />
                              {wf.isTemplate ? 'Remove pod template' : 'Mark as pod template'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void duplicateWorkflow(wf.id)}>
                              <HugeiconsIcon icon={Copy01Icon} className="mr-2 size-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPublishDialog(wf)}>
                              <HugeiconsIcon icon={ArrowUp01Icon} className="mr-2 size-4" />
                              Publish to gallery
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void trashWorkflow(wf.id)}
                            >
                              <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
                              Move to trash
                            </DropdownMenuItem>
                          </>
                        )}
                        {view === 'trash' && (
                          <>
                            <DropdownMenuItem onClick={() => void restoreWorkflow(wf.id)}>
                              <HugeiconsIcon icon={Undo02Icon} className="mr-2 size-4" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setHardDeleteTarget(wf)}
                            >
                              <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
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

      {/* Create workflow dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Lead scoring pipeline"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="What does this workflow do?"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={!newName.trim() || creating}>
              {creating ? 'Creating…' : 'Create & open builder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish to gallery dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish to gallery</DialogTitle>
            <DialogDescription>
              This workflow will be added to the public template gallery and available to all users.
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
              <Select value={publishCategory} onValueChange={setPublishCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button
              disabled={!publishName.trim() || !publishCategory || publishing}
              onClick={() => void handlePublish()}
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirm */}
      <Dialog open={!!hardDeleteTarget} onOpenChange={(o) => { if (!o) setHardDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete permanently?</DialogTitle>
            <DialogDescription>
              <strong>{hardDeleteTarget?.name}</strong> will be permanently deleted and cannot be recovered. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={hardDeleting}
              onClick={() => void hardDeleteWorkflow()}
            >
              {hardDeleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
