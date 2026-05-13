'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
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
import { HugeiconsIcon } from '@hugeicons/react';
import {
  LinkSquare01Icon,
  Copy01Icon,
  Delete01Icon,
  Add01Icon,
  CheckmarkSquare01Icon,
} from '@hugeicons/core-free-icons';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

interface Webhook {
  id: string;
  workflowId: string;
  createdAt: string;
}

interface Workflow {
  id: string;
  name: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={() => void copy()}
      title="Copy"
      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkSquare01Icon : Copy01Icon}
        className={`size-3.5 ${copied ? 'text-green-500' : ''}`}
      />
    </button>
  );
}

export default function WebhooksPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{ webhookId: string; secret: string } | null>(null);

  const webhooksKey = ['webhooks', activeWorkspace?.id, podId];
  const workflowsKey = ['workflows', activeWorkspace?.id, podId];

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: webhooksKey,
    enabled: !!activeWorkspace && !wsLoading,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      return api.get<Webhook[]>(`/workspaces/${activeWorkspace!.id}/pods/${podId}/webhooks`);
    },
  });

  const { data: workflows = [], isFetching: fetchingWorkflows } = useQuery({
    queryKey: workflowsKey,
    enabled: createOpen && !!activeWorkspace,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      const res = await api.get<{ workflows: Workflow[] }>(
        `/workspaces/${activeWorkspace!.id}/pods/${podId}/workflows`,
      );
      return res.workflows;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const api = createApiClient(token);
      return api.post<{ id: string; workflowId: string; secretToken: string; createdAt: string }>(
        `/workspaces/${activeWorkspace!.id}/pods/${podId}/webhooks`,
        { workflowId },
      );
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: webhooksKey });
      setCreateOpen(false);
      setSelectedWorkflowId('');
      setNewSecret({ webhookId: created.id, secret: created.secretToken });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const api = createApiClient(token);
      return api.delete(`/workspaces/${activeWorkspace!.id}/pods/${podId}/webhooks/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhooksKey });
      setDeleteTarget(null);
    },
  });

  function triggerUrl(id: string) {
    return `${API_BASE}/webhooks/${id}/trigger`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Webhooks</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!activeWorkspace}>
          <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-3.5" />
          Add webhook
        </Button>
      </div>

      {isLoading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={LinkSquare01Icon} className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No webhooks yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Webhooks let external services trigger a workflow via a signed HTTP request.
          </p>
          <Button size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
            Add webhook
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger URL</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs text-muted-foreground truncate max-w-xs">
                      {triggerUrl(wh.id)}
                    </code>
                    <CopyButton value={triggerUrl(wh.id)} />
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">
                  {wh.workflowId.slice(0, 8)}…
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(wh.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(wh.id)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add webhook</DialogTitle>
            <DialogDescription>
              Select a workflow to trigger when this webhook receives a request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Workflow</Label>
            {fetchingWorkflows ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a workflow…" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.length === 0 ? (
                    <SelectItem value="_none" disabled>No workflows in this pod</SelectItem>
                  ) : (
                    workflows.map((wf) => (
                      <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(selectedWorkflowId)}
              disabled={!selectedWorkflowId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret reveal dialog */}
      <Dialog open={!!newSecret} onOpenChange={() => setNewSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook created</DialogTitle>
            <DialogDescription>
              Copy your signing secret now — it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Trigger URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={newSecret ? triggerUrl(newSecret.webhookId) : ''}
                  className="font-mono text-xs"
                />
                {newSecret && <CopyButton value={triggerUrl(newSecret.webhookId)} />}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Signing secret</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={newSecret?.secret ?? ''}
                  className="font-mono text-xs"
                />
                {newSecret && <CopyButton value={newSecret.secret} />}
              </div>
              <p className="text-xs text-muted-foreground">
                Verify incoming requests by checking the <code className="text-xs">x-linea-signature</code> header.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any service using this webhook will stop receiving triggers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
