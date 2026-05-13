'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
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

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  featured: boolean;
  downloads: number;
  thumbnailUrl: string | null;
  workflowId: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Productivity: 'bg-blue-100 text-blue-700',
  Communication: 'bg-purple-100 text-purple-700',
  Data: 'bg-green-100 text-green-700',
  DevOps: 'bg-orange-100 text-orange-700',
  Automation: 'bg-yellow-100 text-yellow-700',
  Marketing: 'bg-pink-100 text-pink-700',
};

export default function TemplatesPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { pods, activePod } = usePod();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [targetPodId, setTargetPodId] = useState<string>('');
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (activeCategory) params.set('category', activeCategory);
        const rows = await api.get<Template[]>(`/templates?${params}`);
        setTemplates(rows);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, activeCategory, getToken]);

  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();

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
      router.push(`/pods/${targetPodId}/workflows/${wf.id}`);
    } finally {
      setCloning(false);
    }
  }

  const filtered = templates.filter((t) =>
    search ? t.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const featured = filtered.filter((t) => t.featured);
  const rest = filtered.filter((t) => !t.featured);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold">Template gallery</h1>
        <p className="text-sm text-muted-foreground">Start with a pre-built workflow and customise it.</p>
      </div>

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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates found.</p>
      ) : (
        <>
          {featured.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Featured</p>
              <TemplateGrid templates={featured} onUse={openUseDialog} />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {featured.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">More templates</p>
              )}
              <TemplateGrid templates={rest} onUse={openUseDialog} />
            </section>
          )}
        </>
      )}

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
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>
              Cancel
            </Button>
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
  onUse,
}: {
  templates: Template[];
  onUse: (t: Template) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((tpl) => (
        <TemplateCard key={tpl.id} template={tpl} onUse={onUse} />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: (t: Template) => void;
}) {
  const colorClass =
    CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="group rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug">{template.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
          {template.category}
        </span>
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
          onClick={() => onUse(template)}
        >
          Use template
        </Button>
      </div>
    </div>
  );
}
