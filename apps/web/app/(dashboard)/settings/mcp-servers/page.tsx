'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Badge } from '@linea/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, Edit01Icon, Plug01Icon, LinkSquare01Icon } from '@hugeicons/core-free-icons';

interface McpServer {
  id: string;
  name: string;
  url: string;
  authType: 'none' | 'api_key' | 'bearer' | 'oauth';
  hasToken: boolean;
  createdAt: string;
}

interface FormState {
  name: string;
  url: string;
  authType: 'none' | 'api_key' | 'bearer' | 'oauth';
  accessToken: string;
}

const BLANK: FormState = { name: '', url: '', authType: 'bearer', accessToken: '' };

const AUTH_TYPE_LABELS: Record<string, string> = {
  none: 'None',
  api_key: 'API Key',
  bearer: 'Bearer Token',
  oauth: 'OAuth',
};

export default function McpServersPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<McpServer[]>(`/workspaces/${activeWorkspace.id}/mcp-servers`);
      setServers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading]);

  function openAdd() {
    setEditingId(null);
    setForm(BLANK);
    setDialogOpen(true);
  }

  function openEdit(s: McpServer) {
    setEditingId(s.id);
    setForm({ name: s.name, url: s.url, authType: s.authType, accessToken: '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!activeWorkspace || !form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        url: form.url.trim(),
        authType: form.authType,
      };
      if (form.accessToken.trim()) payload['accessToken'] = form.accessToken.trim();

      if (editingId) {
        const updated = await api.patch<McpServer>(
          `/workspaces/${activeWorkspace.id}/mcp-servers/${editingId}`,
          payload,
        );
        setServers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        const created = await api.post<McpServer>(
          `/workspaces/${activeWorkspace.id}/mcp-servers`,
          payload,
        );
        setServers((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!activeWorkspace) return;
    setDeleting(id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/mcp-servers/${id}`);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  if (wsLoading || loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium">MCP Servers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect Model Context Protocol servers to use in MCP nodes. Access tokens are stored encrypted.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          Add server
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HugeiconsIcon icon={Plug01Icon} className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No MCP servers</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
            Add an MCP server to use it in MCP nodes inside your workflows.
          </p>
          <Button size="sm" className="mt-4" onClick={openAdd}>
            Add server
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <HugeiconsIcon icon={Plug01Icon} className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{s.name}</p>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {AUTH_TYPE_LABELS[s.authType] ?? s.authType}
                  </Badge>
                  {s.hasToken && (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      Token set
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={LinkSquare01Icon} className="size-3 shrink-0" />
                  <span className="truncate font-mono">{s.url}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon-sm" variant="ghost" onClick={() => openEdit(s)} title="Edit">
                  <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deleting === s.id}
                  onClick={() => void handleDelete(s.id)}
                  title="Delete"
                >
                  <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Using MCP servers in workflows</p>
        <p>
          After adding a server here, open a workflow in the builder, drag an{' '}
          <strong>MCP</strong> node onto the canvas, and select the server from the dropdown.
          The node will call the server&apos;s tools during execution.
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit MCP server' : 'Add MCP server'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="My MCP server"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Server URL</Label>
              <Input
                placeholder="https://mcp.example.com/sse"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auth type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.authType}
                onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value as FormState['authType'] }))}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="oauth">OAuth</option>
              </select>
            </div>
            {form.authType !== 'none' && (
              <div className="space-y-1.5">
                <Label>
                  Access token{' '}
                  {editingId && (
                    <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder={editingId ? '••••••••  (re-enter to rotate)' : 'Token / API key'}
                  value={form.accessToken}
                  onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.name.trim() || !form.url.trim() || saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
