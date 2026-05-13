'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Badge } from '@linea/ui/components/badge';
import { Separator } from '@linea/ui/components/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, Edit01Icon, Plug01Icon } from '@hugeicons/core-free-icons';

interface McpServer {
  id: string;
  name: string;
  url: string;
  authType: 'none' | 'api_key' | 'bearer' | 'oauth';
  status: 'unknown' | 'connected' | 'error';
  hasToken: boolean;
  createdAt: string;
}

interface FormState {
  name: string;
  url: string;
  authType: 'none' | 'api_key' | 'bearer' | 'oauth';
  accessToken: string;
}

const BLANK: FormState = { name: '', url: '', authType: 'none', accessToken: '' };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  connected: 'default',
  error: 'destructive',
  unknown: 'outline',
};

export default function ConnectionsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<McpServer | null>(null);
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

  function openCreate() {
    setEditTarget(null);
    setForm(BLANK);
    setDialogOpen(true);
  }

  function openEdit(server: McpServer) {
    setEditTarget(server);
    setForm({ name: server.name, url: server.url, authType: server.authType, accessToken: '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!activeWorkspace || !form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const body: Record<string, string> = {
        name: form.name.trim(),
        url: form.url.trim(),
        authType: form.authType,
      };
      if (form.accessToken.trim()) body.accessToken = form.accessToken.trim();

      if (editTarget) {
        const updated = await api.patch<McpServer>(
          `/workspaces/${activeWorkspace.id}/mcp-servers/${editTarget.id}`,
          body,
        );
        setServers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        const created = await api.post<McpServer>(
          `/workspaces/${activeWorkspace.id}/mcp-servers`,
          body,
        );
        setServers((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(server: McpServer) {
    if (!activeWorkspace) return;
    setDeleting(server.id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/mcp-servers/${server.id}`);
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } finally {
      setDeleting(null);
    }
  }

  const needsToken = form.authType !== 'none';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">MCP Connections</h2>
          <p className="text-sm text-muted-foreground">
            Connect Model Context Protocol servers to use as tools in your workflows.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} />
          Add connection
        </Button>
      </div>

      <Separator />

      {loading || wsLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : servers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HugeiconsIcon icon={Plug01Icon} className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No MCP servers connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a server URL to use external tools in your agent workflows.
          </p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            Add connection
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div key={server.id} className="flex items-center gap-4 rounded-lg border p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <HugeiconsIcon icon={Plug01Icon} className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{server.name}</p>
                  <Badge variant={STATUS_VARIANT[server.status] ?? 'outline'} className="text-[10px]">
                    {server.status}
                  </Badge>
                  {server.hasToken && (
                    <Badge variant="secondary" className="text-[10px]">token set</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{server.url}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => openEdit(server)}>
                  <HugeiconsIcon icon={Edit01Icon} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  disabled={deleting === server.id}
                  onClick={() => void handleDelete(server)}
                >
                  <HugeiconsIcon icon={Delete01Icon} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit connection' : 'Add MCP connection'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Firecrawl, Browserbase"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Server URL</Label>
              <Input
                placeholder="https://mcp.example.com"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auth type</Label>
              <NativeSelect
                value={form.authType}
                onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value as FormState['authType'] }))}
                className="w-full"
              >
                <NativeSelectOption value="none">None</NativeSelectOption>
                <NativeSelectOption value="bearer">Bearer token</NativeSelectOption>
                <NativeSelectOption value="api_key">API key</NativeSelectOption>
                <NativeSelectOption value="oauth">OAuth</NativeSelectOption>
              </NativeSelect>
            </div>
            {needsToken && (
              <div className="space-y-1.5">
                <Label>
                  Access token{' '}
                  {editTarget?.hasToken && (
                    <span className="text-muted-foreground">(leave blank to keep existing)</span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder={editTarget?.hasToken ? '••••••••' : 'Paste token…'}
                  value={form.accessToken}
                  onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!form.name.trim() || !form.url.trim() || saving}
            >
              {saving ? 'Saving…' : editTarget ? 'Update' : 'Add connection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
