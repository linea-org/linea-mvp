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
  Search01Icon,
  Add01Icon,
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

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  category: string;
  source: string;
}

type ViewMode = 'active' | 'favorites' | 'pod-templates' | 'trash';
type CreateStep = 'choice' | 'name';

const CATEGORIES = ['Productivity', 'Communication', 'Data', 'DevOps', 'Automation', 'Marketing'];

const CATEGORY_COLORS: Record<string, string> = {
  Productivity:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Communication: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Data:          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DevOps:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Automation:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Marketing:     'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  AI:            'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Content:       'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Research:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Sales:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Safety:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Analytics:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

export default function WorkflowsPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('active');

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>('choice');
  const [createMode, setCreateMode] = useState<'blank' | 'template'>('blank');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Template picker state
  const [pickedTemplate, setPickedTemplate] = useState<TemplateOption | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateList, setTemplateList] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

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

  async function loadTemplates() {
    const token = await getToken();
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const api = createApiClient(token);
      const rows = await api.get<TemplateOption[]>('/templates');
      setTemplateList(rows);
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    if (!wsLoading && activeWorkspace) void load(view);
  }, [activeWorkspace, wsLoading, podId, view]);

  function openCreateDialog() {
    setCreateOpen(true);
    setCreateStep('choice');
    setCreateMode('blank');
    setPickedTemplate(null);
    setNewName('');
    setNewDesc('');
    setTemplateSearch('');
    void loadTemplates();
  }

  function resetCreateDialog() {
    setCreateStep('choice');
    setCreateMode('blank');
    setPickedTemplate(null);
    setNewName('');
    setNewDesc('');
    setTemplateSearch('');
  }

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
      resetCreateDialog();
      router.push(`/pods/${podId}/workflows/${wf.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate() {
    if (!activeWorkspace || !pickedTemplate || !newName.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const wf = await api.post<Workflow>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/from-template/${pickedTemplate.id}`,
        { name: newName.trim() },
      );
      localStorage.setItem('linea_gs_workflow', 'true');
      setCreateOpen(false);
      resetCreateDialog();
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

  const filteredTemplateList = templateList.filter((t) =>
    !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()),
  );

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

      {/* ── Create workflow dialog (2-step) ───────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateDialog();
        }}
      >
        <DialogContent className={createStep === 'choice' ? 'sm:max-w-2xl' : 'sm:max-w-md'} showCloseButton={false}>
          {createStep === 'choice' ? (
            <>
              <DialogHeader>
                <DialogTitle>New workflow</DialogTitle>
                <DialogDescription>Start blank or pick a template to get going faster.</DialogDescription>
              </DialogHeader>

              {/* Blank option */}
              <button
                className="flex items-center gap-3 rounded-lg border-2 border-dashed p-4 hover:border-primary hover:bg-muted/40 transition-colors text-left w-full group"
                onClick={() => {
                  setCreateMode('blank');
                  setNewName('');
                  setNewDesc('');
                  setCreateStep('name');
                }}
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted group-hover:bg-background transition-colors shrink-0">
                  <HugeiconsIcon icon={Add01Icon} className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">New blank workflow</p>
                  <p className="text-xs text-muted-foreground">Start with an empty canvas and build from scratch</p>
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or start from a template</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Template search */}
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                />
                <Input
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Template mini-grid */}
              {loadingTemplates ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : filteredTemplateList.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {templateSearch ? 'No templates match your search.' : 'No templates available.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {filteredTemplateList.map((tpl) => (
                    <button
                      key={tpl.id}
                      className="rounded-lg border p-3 text-left hover:bg-muted/50 hover:border-primary/60 transition-colors"
                      onClick={() => {
                        setPickedTemplate(tpl);
                        setNewName(tpl.name);
                        setCreateMode('template');
                        setCreateStep('name');
                      }}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <p className="text-xs font-medium leading-snug truncate flex-1">{tpl.name}</p>
                        {tpl.source === 'internal' && (
                          <span className="text-[9px] text-muted-foreground bg-muted rounded px-1 py-0.5 shrink-0">Built-in</span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">{tpl.description}</p>
                      )}
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CATEGORY_COLORS[tpl.category] ?? 'bg-muted text-muted-foreground'}`}>
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
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit"
                  onClick={() => {
                    setCreateStep('choice');
                    setPickedTemplate(null);
                    setNewName('');
                  }}
                >
                  ← Back
                </button>
                <DialogTitle>
                  {createMode === 'template' ? 'Name your workflow' : 'New blank workflow'}
                </DialogTitle>
                {createMode === 'template' && pickedTemplate && (
                  <DialogDescription>
                    Starting from "{pickedTemplate.name}"
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    placeholder={pickedTemplate?.name ?? 'e.g. Lead scoring pipeline'}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void (createMode === 'template' ? handleCreateFromTemplate() : handleCreate());
                      }
                    }}
                    autoFocus
                  />
                </div>
                {createMode === 'blank' && (
                  <div className="space-y-1.5">
                    <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      placeholder="What does this workflow do?"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => void (createMode === 'template' ? handleCreateFromTemplate() : handleCreate())}
                  disabled={!newName.trim() || creating}
                >
                  {creating ? 'Creating…' : 'Create & open builder'}
                </Button>
              </DialogFooter>
            </>
          )}
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
