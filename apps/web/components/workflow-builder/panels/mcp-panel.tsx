'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient, friendlyApiError } from '@/lib/api';
import { toast } from '@linea/ui/components/sonner';
import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import { Label } from '@linea/ui/components/label';

interface McpPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

interface McpServer { id: string; name: string; url: string }

const OUTPUT_OPTIONS = [
  { value: 'full',     label: 'Full response' },
  { value: 'text',     label: 'Text only' },
  { value: 'json',     label: 'JSON parsed' },
  { value: 'markdown', label: 'Markdown' },
];

export function McpPanel({ data, onUpdate }: McpPanelProps) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    async function load() {
      if (!activeWorkspace) return;
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const list = await api.get<McpServer[]>(`/workspaces/${activeWorkspace.id}/mcp-servers`);
        setServers(list);
      } catch (err) {
        toast.error(friendlyApiError(err));
      }
    }
    void load();
  }, [activeWorkspace, getToken]);

  const selectedServerId = (data.mcpServerId as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>MCP Server</Label>
        <Select
          value={selectedServerId || undefined}
          onValueChange={(v) => onUpdate({ mcpServerId: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="— select a server —" />
          </SelectTrigger>
          <SelectContent>
            {servers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {servers.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No MCP servers connected. Add one in Settings → Connections.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mcp-action">Tool name</Label>
        <Input
          id="mcp-action"
          value={(data.mcpAction as string) ?? ''}
          onChange={(e) => onUpdate({ mcpAction: e.target.value })}
          placeholder="e.g. fetch, search, scrape"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Output field</Label>
        <Select
          value={(data.outputField as string) ?? 'full'}
          onValueChange={(v) => onUpdate({ outputField: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mcp-params">Tool params (JSON)</Label>
        <Textarea
          id="mcp-params"
          rows={5}
          value={(data.mcpParams as string) ?? ''}
          onChange={(e) => onUpdate({ mcpParams: e.target.value })}
          placeholder={'{\n  "url": "{{url}}"\n}'}
          className="resize-y font-mono text-[11px]"
        />
      </div>
    </div>
  );
}
