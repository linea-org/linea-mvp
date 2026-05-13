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
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MoreVerticalIcon,
  StarIcon,
  Delete01Icon,
  Undo02Icon,
  WorkflowSquare01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  deployedAt: string | null;
  starred: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'active' | 'starred' | 'trash';

export default function WorkflowsPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  async function load(mode: ViewMode = view) {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const params = new URLSearchParams();
      if (mode === 'trash') params.set('trashed', 'true');
      if (mode === 'starred') params.set('starred', 'true');
      const data = await api.get<{ workflows: Workflow[] }>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows?${params}`,
      );
      setWorkflows(data.workflows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!wsLoading && activeWorkspace) void load(view);
  }, [activeWorkspace, wsLoading, podId, view]);

  async function toggleStar(wf: Workflow) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    await api.patch(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${wf.id}/star`, {
      starred: !wf.starred,
    });
    setWorkflows((prev) =>
      prev.map((w) => w.id === wf.id ? { ...w, starred: !wf.starred } : w)
        .filter((w) => view !== 'starred' || w.starred),
    );
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
    { key: 'starred', label: 'Starred' },
    { key: 'trash', label: 'Trash' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>New workflow</Button>
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
              icon={view === 'trash' ? Delete02Icon : view === 'starred' ? StarIcon : WorkflowSquare01Icon}
              className="size-6 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">
            {view === 'trash' ? 'Trash is empty' : view === 'starred' ? 'No starred workflows' : 'No workflows yet'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {view === 'trash'
              ? 'Workflows you delete will appear here.'
              : view === 'starred'
              ? 'Star workflows to find them quickly here.'
              : 'Create your first workflow to start automating with AI nodes.'}
          </p>
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
                    {wf.starred && <HugeiconsIcon icon={StarIcon} className="size-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                    <div>
                      <p className="font-medium">{wf.name}</p>
                      {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={wf.deployedAt ? 'default' : 'secondary'}>
                    {wf.deletedAt ? 'trashed' : wf.deployedAt ? 'deployed' : 'draft'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(wf.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {view !== 'trash' && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/pods/${podId}/workflows/${wf.id}`}>
                          Open builder
                        </Link>
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
                          <DropdownMenuItem onClick={() => void toggleStar(wf)}>
                            <HugeiconsIcon icon={StarIcon} className="mr-2 size-4" />
                            {wf.starred ? 'Unstar' : 'Star'}
                          </DropdownMenuItem>
                        )}
                        {view !== 'trash' && (
                          <>
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
                          <DropdownMenuItem onClick={() => void restoreWorkflow(wf.id)}>
                            <HugeiconsIcon icon={Undo02Icon} className="mr-2 size-4" />
                            Restore
                          </DropdownMenuItem>
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
    </div>
  );
}
