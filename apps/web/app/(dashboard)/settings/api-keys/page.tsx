"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Badge } from "@linea/ui/components/badge"
import { Skeleton } from "@linea/ui/components/skeleton"
import {
  NativeSelect,
  NativeSelectOption,
} from "@linea/ui/components/native-select"
=======
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@linea/ui/components/dialog"

interface ApiKey {
  id: string
  label: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  status: "active" | "expired"
  createdAt: string
}

export default function ApiKeysPage() {
<<<<<<< HEAD
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [expiresIn, setExpiresIn] = useState<"30d" | "90d" | "365d" | "never">(
    "never"
  )
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  async function loadKeys() {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const data = await api.get<ApiKey[]>(
        `/workspaces/${activeWorkspace.id}/api-keys`
      )
      setKeys(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (wsLoading) return
    if (!activeWorkspace) {
      setLoading(false)
      return
    }
    void loadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace, wsLoading])

  async function handleCreate() {
    if (!activeWorkspace) return
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const result = await api.post<ApiKey & { key: string }>(
        `/workspaces/${activeWorkspace.id}/api-keys`,
        {
          label: label.trim() || undefined,
          expiresIn: expiresIn === "never" ? undefined : expiresIn,
        }
      )
      setNewKey(result.key)
      setKeys((prev) => [
        ...prev,
        {
          id: result.id,
          label: result.label,
          lastUsedAt: result.lastUsedAt,
          expiresAt: result.expiresAt,
          revokedAt: null,
          status: "active",
          createdAt: result.createdAt,
        },
      ])
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    await api.delete(`/workspaces/${activeWorkspace.id}/api-keys/${id}`)
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  function closeDialog() {
    setDialogOpen(false)
    setNewKey(null)
    setLabel("")
    setExpiresIn("never")
=======
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  interface ApiKeyForm { label: string; expiresIn: '30d' | '90d' | '365d' | 'never' }
  const { register, handleSubmit, reset } = useForm<ApiKeyForm>({
    defaultValues: { label: '', expiresIn: 'never' },
  });

  const { data: keys = [], isLoading: loading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<ApiKey[]>(`/workspaces/${wsId}/api-keys`);
    },
  });

  const createKey = useMutation({
    mutationFn: async (values: ApiKeyForm) => {
      const api = await getApi();
      return api.post<ApiKey & { key: string }>(
        `/workspaces/${wsId}/api-keys`,
        { label: values.label.trim() || undefined, expiresIn: values.expiresIn === 'never' ? undefined : values.expiresIn },
      );
    },
    onSuccess: (result) => {
      setNewKey(result.key);
      queryClient.setQueryData<ApiKey[]>(['api-keys', wsId], (prev = []) => [...prev, {
        id: result.id, label: result.label, lastUsedAt: result.lastUsedAt,
        expiresAt: result.expiresAt, revokedAt: null, status: 'active', createdAt: result.createdAt,
      }]);
    },
  });

  const onCreate = handleSubmit((values) => createKey.mutate(values));

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/api-keys/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ApiKey[]>(['api-keys', wsId], (prev = []) => prev.filter((k) => k.id !== id));
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setNewKey(null);
    reset();
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
  }

  if (wsLoading || loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">API Keys</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1 text-xs">lnk_…</code>{" "}
            keys to authenticate SDK and programmatic requests.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New key
        </Button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {k.label ?? "Unnamed key"}
                  </p>
                  <Badge
                    variant={k.status === "active" ? "default" : "destructive"}
                    className={
                      k.status === "active"
                        ? "bg-green-100 px-1.5 py-0 text-[10px] text-green-700 dark:bg-green-950/40 dark:text-green-400"
                        : "px-1.5 py-0 text-[10px]"
                    }
                  >
                    {k.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt
                    ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                    : " · Never used"}
                  {k.expiresAt
                    ? ` · Expires ${new Date(k.expiresAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => revokeKey.mutate(k.id)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) closeDialog()
          else setDialogOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Copy this key now — it won't be shown again.
              </p>
              <div className="flex gap-2">
                <Input value={newKey} readOnly className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(newKey)}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onCreate} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
<<<<<<< HEAD
                <Input
                  placeholder="e.g. Production"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate()
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry</Label>
                <NativeSelect
                  value={expiresIn}
                  onChange={(e) =>
                    setExpiresIn(e.target.value as typeof expiresIn)
                  }
                  className="h-9 text-sm"
                >
=======
                <Input placeholder="e.g. Production" {...register('label')} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry</Label>
                <NativeSelect className="h-9 text-sm" {...register('expiresIn')}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                  <NativeSelectOption value="never">Never</NativeSelectOption>
                  <NativeSelectOption value="30d">30 days</NativeSelectOption>
                  <NativeSelectOption value="90d">90 days</NativeSelectOption>
                  <NativeSelectOption value="365d">1 year</NativeSelectOption>
                </NativeSelect>
              </div>
            </form>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {newKey ? "Done" : "Cancel"}
            </Button>
            {!newKey && (
<<<<<<< HEAD
              <Button onClick={() => void handleCreate()} disabled={creating}>
                {creating ? "Creating…" : "Create"}
=======
              <Button onClick={onCreate} disabled={createKey.isPending}>
                {createKey.isPending ? 'Creating…' : 'Create'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
