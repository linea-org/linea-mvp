'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
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
  ArrowUp01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';

interface Prerequisite {
  type: string;
  label: string;
  description: string;
}

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
  source: string;
  featured: boolean;
  downloads: number;
  views: number;
  upvotes: number;
  thumbnailUrl: string | null;
  workflowId: string | null;
  publishedBy: string | null;
  prerequisites?: Prerequisite[] | null;
  definition?: { nodes: TemplateNode[]; edges: unknown[] } | null;
  // Creator info (populated from LEFT JOIN with users for community templates)
  creatorName?: string | null;
  creatorAvatarUrl?: string | null;
  creatorEmail?: string | null;
}

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

const PREREQ_ICONS: Record<string, string> = {
  rag:       '🗄️',
  slack:     '💬',
  github:    '🐙',
  gmail:     '📧',
  notion:    '📝',
  model_key: '🔑',
  webhook:   '🔗',
};

const NODE_TYPE_LABELS: Record<string, string> = {
  start:           'Start',
  end:             'End',
  agent:           'AI Agent',
  http:            'HTTP Request',
  extract:         'Extract',
  transform:       'Transform',
  code:            'Code',
  loop:            'Loop',
  filter:          'Filter',
  merge:           'Merge',
  parallel:        'Parallel',
  wait:            'Wait',
  variables:       'Variables',
  datetime:        'DateTime',
  memory:          'Memory',
  retriever:       'Retriever',
  guardrails:      'Guardrails',
  evaluator:       'Evaluator',
  'if-else':       'If / Else',
  router:          'Router',
  mcp:             'MCP Tool',
  slack:           'Slack',
  github:          'GitHub',
  gmail:           'Gmail',
  notion:          'Notion',
  'approval-gate': 'Approval Gate',
};

export default function TemplatesPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { pods, activePod } = usePod();
  const router = useRouter();

  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'internal' | 'community'>('internal');

  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [targetPodId, setTargetPodId] = useState<string>('');
  const [workflowName, setWorkflowName] = useState('');
  const [cloning, setCloning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const [rows, upvoted] = await Promise.all([
        api.get<Template[]>('/templates'),
        api.get<string[]>('/templates/me/upvoted').catch(() => [] as string[]),
      ]);
      setAllTemplates(rows);
      setUpvotedIds(new Set(upvoted));
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
    setWorkflowName(tpl.name);
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
        { name: workflowName.trim() || selectedTemplate.name },
      );
      setUseDialogOpen(false);
      setPreviewTemplate(null);
      router.push(`/pods/${targetPodId}/workflows/${wf.id}`);
    } finally {
      setCloning(false);
    }
  }

  async function toggleUpvote(tpl: Template, e: React.MouseEvent) {
    e.stopPropagation();
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const isUpvoted = upvotedIds.has(tpl.id);

    setUpvotedIds((prev) => {
      const next = new Set(prev);
      if (isUpvoted) next.delete(tpl.id); else next.add(tpl.id);
      return next;
    });
    setAllTemplates((prev) =>
      prev.map((t) =>
        t.id === tpl.id ? { ...t, upvotes: t.upvotes + (isUpvoted ? -1 : 1) } : t,
      ),
    );

    try {
      const result = await api.post<{ upvoted: boolean; upvotes: number }>(
        `/templates/${tpl.id}/upvote`,
        {},
      );
      setUpvotedIds((prev) => {
        const next = new Set(prev);
        if (result.upvoted) next.add(tpl.id); else next.delete(tpl.id);
        return next;
      });
      setAllTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? { ...t, upvotes: result.upvotes } : t)),
      );
    } catch {
      setUpvotedIds((prev) => {
        const next = new Set(prev);
        if (isUpvoted) next.add(tpl.id); else next.delete(tpl.id);
        return next;
      });
      setAllTemplates((prev) =>
        prev.map((t) =>
          t.id === tpl.id ? { ...t, upvotes: t.upvotes + (isUpvoted ? 1 : -1) } : t,
        ),
      );
    }
  }

  // Split by source
  const internalAll = allTemplates.filter((t) => t.source === 'internal');
  const communityAll = allTemplates.filter((t) => t.source !== 'internal');
  const sourcePool = activeTab === 'internal' ? internalAll : communityAll;

  const filtered = sourcePool.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeCategory && t.category !== activeCategory) return false;
    return true;
  });

  const categories = Array.from(new Set(sourcePool.map((t) => t.category))).sort();
  const featured = filtered.filter((t) => t.featured);
  const rest = filtered.filter((t) => !t.featured);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Template gallery</h1>
        <p className="text-sm text-muted-foreground">Start with a pre-built workflow and customise it.</p>
      </div>

      {/* Tab: Internal / Community */}
      <div className="flex items-center gap-1 border-b">
        {(['internal', 'community'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setActiveCategory(null); }}
            className={`px-3 pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'internal' ? 'Built-in' : 'Community'}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {tab === 'internal' ? internalAll.length : communityAll.length}
            </span>
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
              icon={search ? Search01Icon : WorkflowSquare01Icon}
              className="size-7 text-muted-foreground"
            />
          </div>
          <h2 className="text-base font-semibold">
            {search ? 'No templates match your search' : activeTab === 'community' ? 'No community templates yet' : 'No built-in templates'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            {search
              ? 'Try a different keyword or clear the search.'
              : activeTab === 'community'
              ? 'Publish your own workflows to the gallery to share them with your team.'
              : 'Built-in templates will appear here.'}
          </p>
          {search && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch('')}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Featured</p>
              <TemplateGrid
                templates={featured}
                upvotedIds={upvotedIds}
                isInternal={activeTab === 'internal'}
                onPreview={openPreview}
                onUse={openUseDialog}
                onToggleUpvote={toggleUpvote}
              />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {featured.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">More templates</p>
              )}
              <TemplateGrid
                templates={rest}
                upvotedIds={upvotedIds}
                isInternal={activeTab === 'internal'}
                onPreview={openPreview}
                onUse={openUseDialog}
                onToggleUpvote={toggleUpvote}
              />
            </section>
          )}
        </>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
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

          <div className="space-y-4 py-2">
            {/* Prerequisites */}
            {previewTemplate?.prerequisites && previewTemplate.prerequisites.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
                  Setup required before use
                </p>
                {previewTemplate.prerequisites.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0 text-sm">{PREREQ_ICONS[p.type] ?? '⚙️'}</span>
                    <div>
                      <span className="font-medium text-foreground">{p.label}</span>
                      <span className="text-muted-foreground"> — {p.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Node list */}
            {previewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)}
              </div>
            ) : previewTemplate?.definition?.nodes?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Nodes ({previewTemplate.definition.nodes.filter(n => n.type !== 'start' && n.type !== 'end').length})
                </p>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {previewTemplate.definition.nodes
                    .filter(n => n.type !== 'start' && n.type !== 'end')
                    .map((node, i) => {
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
            <div className="flex-1 flex items-center gap-3 self-center">
              {previewTemplate && previewTemplate.source !== 'internal' && (
                <>
                  <span className="text-[11px] text-muted-foreground">
                    {previewTemplate.downloads > 0 ? `${previewTemplate.downloads.toLocaleString()} uses` : 'New'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                    {previewTemplate.upvotes}
                  </span>
                </>
              )}
              {previewTemplate?.source === 'internal' && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <HugeiconsIcon icon={BookOpen01Icon} className="size-3" />
                  Built-in
                </span>
              )}
            </div>
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

      {/* ── Use template dialog ───────────────────────────────────────────── */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Use "{selectedTemplate?.name}"</DialogTitle>
            <DialogDescription>
              Name your workflow and pick which pod to add it to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Prerequisites checklist */}
            {selectedTemplate?.prerequisites && selectedTemplate.prerequisites.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <HugeiconsIcon icon={Alert01Icon} className="size-3.5 shrink-0" />
                  Before you start — confirm these are set up
                </p>
                {selectedTemplate.prerequisites.map((p, i) => (
                  <label key={i} className="flex items-start gap-2 cursor-pointer group">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-amber-500 transition-colors"
                    />
                    <span className="text-xs">
                      <span className="font-medium">{p.label}</span>
                      <span className="text-muted-foreground"> — {p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Workflow name */}
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">Workflow name</Label>
              <Input
                id="wf-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder={selectedTemplate?.name ?? 'My workflow'}
                autoFocus
              />
            </div>

            {/* Pod selector */}
            <div className="space-y-1.5">
              <Label>Pod</Label>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!targetPodId || !workflowName.trim() || cloning || pods.length === 0}
              onClick={() => void handleUseTemplate()}
            >
              {cloning ? 'Creating…' : 'Create workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateGrid({
  templates,
  upvotedIds,
  isInternal,
  onPreview,
  onUse,
  onToggleUpvote,
}: {
  templates: Template[];
  upvotedIds: Set<string>;
  isInternal: boolean;
  onPreview: (t: Template) => void;
  onUse: (t: Template) => void;
  onToggleUpvote: (t: Template, e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((tpl) => (
        <TemplateCard
          key={tpl.id}
          template={tpl}
          isUpvoted={upvotedIds.has(tpl.id)}
          isInternal={isInternal}
          onPreview={onPreview}
          onUse={onUse}
          onToggleUpvote={onToggleUpvote}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  isUpvoted,
  isInternal,
  onPreview,
  onUse,
  onToggleUpvote,
}: {
  template: Template;
  isUpvoted: boolean;
  isInternal: boolean;
  onPreview: (t: Template) => void;
  onUse: (t: Template) => void;
  onToggleUpvote: (t: Template, e: React.MouseEvent) => void;
}) {
  const colorClass = CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-700';
  const hasPrereqs = template.prerequisites && template.prerequisites.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      className="group rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow text-left w-full cursor-pointer"
      onClick={() => onPreview(template)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPreview(template)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-medium text-sm leading-snug truncate">{template.name}</p>
          {hasPrereqs && (
            <span title="Requires setup">
              <HugeiconsIcon
                icon={Alert01Icon}
                className="size-3 shrink-0 text-amber-500"
              />
            </span>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
          {template.category}
        </span>
      </div>
      {template.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        {/* Footer: internal shows "Built-in", community shows creator + upvotes */}
        {isInternal ? (
          <span className="text-[11px] text-muted-foreground">Built-in</span>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {/* Creator info */}
            {(template.creatorName || template.creatorAvatarUrl || template.creatorEmail) ? (
              <div className="flex items-center gap-1 min-w-0">
                {template.creatorAvatarUrl ? (
                  <img
                    src={template.creatorAvatarUrl}
                    alt={template.creatorName ?? ''}
                    className="size-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="size-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium shrink-0">
                    {(template.creatorName ?? template.creatorEmail ?? 'C')[0]?.toUpperCase() ?? 'C'}
                  </div>
                )}
                <span className="text-[11px] text-muted-foreground truncate max-w-[72px]">
                  {template.creatorName || template.creatorEmail?.split('@')[0] || 'Community'}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {template.downloads > 0 ? `${template.downloads} uses` : 'Community'}
              </span>
            )}
            {/* Upvote button */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleUpvote(template, e); }}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors shrink-0 ${
                isUpvoted
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={isUpvoted ? 'Remove upvote' : 'Upvote'}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
              {template.upvotes}
            </button>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => { e.stopPropagation(); onUse(template); }}
        >
          Use
        </Button>
      </div>
    </div>
  );
}
