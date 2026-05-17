'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import {
  Add01Icon,
  Delete01Icon,
  Edit01Icon,
  Plug01Icon,
  CheckmarkCircle01Icon,
  LinkSquare01Icon,
} from '@hugeicons/core-free-icons';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

interface OAuthConnection {
  id: string;
  provider: string;
  providerEmail: string | null;
  scope: string | null;
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
  updatedAt: string;
}

const OAUTH_PROVIDERS = [
  { id: 'google',  label: 'Google',  description: 'Gmail, Google Sheets, Drive' },
  { id: 'slack',   label: 'Slack',   description: 'Send messages, read channels' },
  { id: 'github',  label: 'GitHub',  description: 'Issues, PRs, repositories' },
  { id: 'notion',  label: 'Notion',  description: 'Read and write Notion pages' },
];

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
  const searchParams = useSearchParams();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<McpServer | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [oauthConnections, setOauthConnections] = useState<OAuthConnection[]>([]);
  const [oauthLoading, setOauthLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

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

  async function loadOAuth() {
    if (!activeWorkspace) return;
    setOauthLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<OAuthConnection[]>(`/workspaces/${activeWorkspace.id}/oauth/connections`);
      setOauthConnections(data);
    } catch {
      setOauthConnections([]);
    } finally {
      setOauthLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); setOauthLoading(false); return; }
    void load();
    void loadOAuth();
  }, [activeWorkspace, wsLoading]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected && activeWorkspace) {
      void loadOAuth();
    }
  }, [searchParams]);

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

  async function handleDisconnectOAuth(id: string) {
    if (!activeWorkspace) return;
    setDisconnecting(id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/oauth/connections/${id}`);
      setOauthConnections((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDisconnecting(null);
    }
  }

  function handleConnectOAuth(provider: string) {
    if (!activeWorkspace) return;
    window.location.href = `${API_URL}/oauth/${provider}/connect?workspaceId=${activeWorkspace.id}`;
  }

  const needsToken = form.authType !== 'none';

  return (
    <div className="space-y-6">
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

      <Separator />

      {/* OAuth Connected Apps */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Connected Apps</h2>
          <p className="text-sm text-muted-foreground">
            OAuth integrations for use in Slack, GitHub, Gmail, and Notion workflow nodes.
          </p>
        </div>

        {searchParams.get('connected') && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/30 dark:border-green-900">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong className="capitalize">{searchParams.get('connected')}</strong> connected successfully.
            </p>
          </div>
        )}

        {oauthLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {OAUTH_PROVIDERS.map((provider) => {
              const conn = oauthConnections.find((c) => c.provider === provider.id);
              return (
                <div key={provider.id} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{provider.label}</p>
                      {conn && !conn.expired && (
                        <Badge variant="default" className="text-[10px]">connected</Badge>
                      )}
                      {conn?.expired && (
                        <Badge variant="destructive" className="text-[10px]">expired</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {conn?.providerEmail ?? provider.description}
                    </p>
                  </div>
                  {conn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disconnecting === conn.id}
                      onClick={() => void handleDisconnectOAuth(conn.id)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="mr-1.5 size-3.5" />
                      {disconnecting === conn.id ? 'Disconnecting…' : 'Disconnect'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnectOAuth(provider.id)}
                    >
                      <HugeiconsIcon icon={LinkSquare01Icon} className="mr-1.5 size-3.5" />
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
