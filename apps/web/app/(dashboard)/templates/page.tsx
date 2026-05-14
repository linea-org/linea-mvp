'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Skeleton } from '@linea/ui/components/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@linea/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  Search01Icon,
  FavouriteIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

interface TemplateNode {
  id: string;
  type: string;
  data: { label?: string; nodeType?: string; [key: string]: unknown };
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  featured: boolean;
  downloads: number;
  thumbnailUrl: string | null;
  workflowId: string | null;
  definition?: { nodes: TemplateNode[]; edges: unknown[] } | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Productivity: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Communication: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Data: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DevOps: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Automation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

const NODE_TYPE_LABELS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  agent: 'AI Agent',
  http: 'HTTP Request',
  extract: 'Extract',
  transform: 'Transform',
  code: 'Code',
  loop: 'Loop',
  condition: 'Condition',
  memory: 'Memory',
  retriever: 'Retriever',
  mcp: 'MCP Tool',
  slack: 'Slack',
  github: 'GitHub',
  'approval-gate': 'Approval Gate',
};

type ViewTab = 'all' | 'favorites';

export default function TemplatesPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { pods, activePod } = usePod();
  const router = useRouter();

  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ViewTab>('all');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [targetPodId, setTargetPodId] = useState<string>('');
  const [cloning, setCloning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const [rows, favIds] = await Promise.all([
        api.get<Template[]>('/templates'),
        api.get<string[]>('/templates/me/favorites').catch(() => [] as string[]),
      ]);
      setAllTemplates(rows);
      setFavoriteIds(new Set(favIds));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function openPreview(tpl: Template) {
    setPreviewTemplate(tpl);
    if (!tpl.definition) {
      setPreviewLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const full = await api.get<Template>(`/templates/${tpl.id}`);
        setPreviewTemplate(full);
      } finally {
        setPreviewLoading(false);
      }
    }
  }

  function openUseDialog(tpl: Template) {
    setSelectedTemplate(tpl);
    setTargetPodId(activePod?.id ?? pods[0]?.id ?? '');
    setUseDialogOpen(true);
  }

  async function handleUseTemplate() {
    if (!selectedTemplate || !activeWorkspace || !targetPodId) return;
    setCloning(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const wf = await api.post<{ id: string }>(
        `/workspaces/${activeWorkspace.id}/pods/${targetPodId}/workflows/from-template/${selectedTemplate.id}`,
        {},
      );
      setUseDialogOpen(false);
      setPreviewTemplate(null);
      router.push(`/pods/${targetPodId}/workflows/${wf.id}`);
    } finally {
      setCloning(false);
    }
  }

  async function toggleFavorite(tpl: Template, e: React.MouseEvent) {
    e.stopPropagation();
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const isFav = favoriteIds.has(tpl.id);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(tpl.id); else next.add(tpl.id);
      return next;
    });

    try {
      if (isFav) {
        await api.delete(`/templates/${tpl.id}/favorite`);
      } else {
        await api.post(`/templates/${tpl.id}/favorite`, {});
      }
    } catch {
      // revert on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(tpl.id); else next.delete(tpl.id);
        return next;
      });
    }
  }

  const searched = allTemplates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeCategory && t.category !== activeCategory) return false;
    return true;
  });

  const filtered = tab === 'favorites' ? searched.filter((t) => favoriteIds.has(t.id)) : searched;
  const categories = Array.from(new Set(allTemplates.map((t) => t.category))).sort();
  const featured = filtered.filter((t) => t.featured);
  const rest = filtered.filter((t) => !t.featured);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold">Template gallery</h1>
        <p className="text-sm text-muted-foreground">Start with a pre-built workflow and customise it.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {(['all', 'favorites'] as ViewTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'pb-2 text-sm capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t === 'favorites' ? 'Saved' : 'All templates'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={activeCategory === null ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <HugeiconsIcon
              icon={tab === 'favorites' ? FavouriteIcon : search ? Search01Icon : WorkflowSquare01Icon}
              className="size-7 text-muted-foreground"
            />
          </div>
          <h2 className="text-base font-semibold">
            {tab === 'favorites'
              ? 'No saved templates'
              : search
                ? 'No templates match your search'
                : 'No templates yet'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            {tab === 'favorites'
              ? 'Save templates by clicking the bookmark icon on any card.'
              : search
                ? 'Try a different keyword or clear the search to browse all templates.'
                : 'Templates will appear here once they are published to the gallery.'}
          </p>
          {(search || tab === 'favorites') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setSearch(''); setTab('all'); }}
            >
              Browse all templates
            </Button>
          )}
        </div>
      ) : (
        <>
          {featured.length > 0 && tab === 'all' && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Featured</p>
              <TemplateGrid
                templates={featured}
                favoriteIds={favoriteIds}
                onPreview={openPreview}
                onUse={openUseDialog}
                onToggleFavorite={toggleFavorite}
              />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {featured.length > 0 && tab === 'all' && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">More templates</p>
              )}
              <TemplateGrid
                templates={rest}
                favoriteIds={favoriteIds}
                onPreview={openPreview}
                onUse={openUseDialog}
                onToggleFavorite={toggleFavorite}
              />
            </section>
          )}
          {tab === 'favorites' && (
            <TemplateGrid
              templates={filtered}
              favoriteIds={favoriteIds}
              onPreview={openPreview}
              onUse={openUseDialog}
              onToggleFavorite={toggleFavorite}
            />
          )}
        </>
      )}

      {/* Preview modal */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => { if (!o) setPreviewTemplate(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>{previewTemplate?.name}</DialogTitle>
                {previewTemplate?.description && (
                  <DialogDescription className="mt-1">{previewTemplate.description}</DialogDescription>
                )}
              </div>
              {previewTemplate && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[previewTemplate.category] ?? 'bg-muted text-muted-foreground'}`}>
                  {previewTemplate.category}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="py-2">
            {previewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)}
              </div>
            ) : previewTemplate?.definition?.nodes?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Nodes ({previewTemplate.definition.nodes.length})
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {previewTemplate.definition.nodes.map((node, i) => {
                    const label = node.data.label || NODE_TYPE_LABELS[node.type] || node.type;
                    const typeLabel = NODE_TYPE_LABELS[node.type] ?? node.type;
                    return (
                      <div
                        key={node.id}
                        className="flex items-center gap-2.5 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="text-[10px] tabular-nums text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <span className="font-medium flex-1">{label}</span>
                        {label !== typeLabel && (
                          <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No node details available.</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <p className="flex-1 text-[11px] text-muted-foreground self-center">
              {previewTemplate && previewTemplate.downloads > 0
                ? `${previewTemplate.downloads.toLocaleString()} uses`
                : 'New'}
            </p>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Close</Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  setPreviewTemplate(null);
                  openUseDialog(previewTemplate);
                }
              }}
            >
              Use template
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use template dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use template</DialogTitle>
            <DialogDescription>
              Select a pod to clone <strong>{selectedTemplate?.name}</strong> into.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {pods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pods found. Create a pod first from the Pods page.
              </p>
            ) : (
              <Select value={targetPodId} onValueChange={setTargetPodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pod" />
                </SelectTrigger>
                <SelectContent>
                  {pods.map((pod) => (
                    <SelectItem key={pod.id} value={pod.id}>
                      {pod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!targetPodId || cloning || pods.length === 0}
              onClick={() => void handleUseTemplate()}
            >
              {cloning ? 'Cloning…' : 'Use template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateGrid({
  templates,
  favoriteIds,
  onPreview,
  onUse,
  onToggleFavorite,
}: {
  templates: Template[];
  favoriteIds: Set<string>;
  onPreview: (t: Template) => void;
  onUse: (t: Template) => void;
  onToggleFavorite: (t: Template, e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((tpl) => (
        <TemplateCard
          key={tpl.id}
          template={tpl}
          isFavorited={favoriteIds.has(tpl.id)}
          onPreview={onPreview}
          onUse={onUse}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  isFavorited,
  onPreview,
  onUse,
  onToggleFavorite,
}: {
  template: Template;
  isFavorited: boolean;
  onPreview: (t: Template) => void;
  onUse: (t: Template) => void;
  onToggleFavorite: (t: Template, e: React.MouseEvent) => void;
}) {
  const colorClass =
    CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-700';

  return (
    <button
      className="group rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow text-left w-full"
      onClick={() => onPreview(template)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug">{template.name}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => onToggleFavorite(template, e)}
            className={`rounded-md p-1 transition-colors ${
              isFavorited
                ? 'text-yellow-500'
                : 'text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100'
            }`}
            title={isFavorited ? 'Remove from saved' : 'Save template'}
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              className="size-3.5"
              style={{ fill: isFavorited ? 'currentColor' : 'none' }}
            />
          </button>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
            {template.category}
          </span>
        </div>
      </div>
      {template.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {template.downloads > 0 ? `${template.downloads.toLocaleString()} uses` : 'New'}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onUse(template); }}
        >
          Use
        </Button>
      </div>
    </button>
  );
}
