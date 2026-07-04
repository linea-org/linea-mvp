"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Skeleton } from "@linea/ui/components/skeleton"
=======
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@linea/ui/components/dialog"

interface Secret {
  id: string
  name: string
  createdAt: string
}

export default function CredentialsPage() {
<<<<<<< HEAD
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [nameError, setNameError] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const data = await api.get<Secret[]>(
        `/workspaces/${activeWorkspace.id}/secrets`
      )
      setSecrets(data)
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
    void load()
  }, [activeWorkspace, wsLoading])

  function validateName(v: string) {
    if (!v) return "Name is required"
    if (!/^[A-Z][A-Z0-9_]*$/.test(v))
      return "Must be uppercase letters, digits, and underscores"
    return ""
  }

  async function handleCreate() {
    const err = validateName(name)
    if (err) {
      setNameError(err)
      return
    }
    if (!activeWorkspace || !value.trim()) return
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const created = await api.post<Secret>(
        `/workspaces/${activeWorkspace.id}/secrets`,
        {
          name: name.trim(),
          value: value.trim(),
        }
      )
      setSecrets((prev) => [...prev, created])
      setDialogOpen(false)
      setName("")
      setValue("")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!activeWorkspace) return
    setDeleting(id)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.delete(`/workspaces/${activeWorkspace.id}/secrets/${id}`)
      setSecrets((prev) => prev.filter((s) => s.id !== id))
    } finally {
      setDeleting(null)
    }
  }
=======
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';
  const [dialogOpen, setDialogOpen] = useState(false);

  interface SecretForm { name: string; value: string }
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SecretForm>({
    defaultValues: { name: '', value: '' },
  });
  const nameValue = watch('name');
  const valueValue = watch('value');

  const { data: secrets = [], isLoading: loading } = useQuery<Secret[]>({
    queryKey: ['secrets', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<Secret[]>(`/workspaces/${wsId}/secrets`);
    },
  });

  const createSecret = useMutation({
    mutationFn: async (values: SecretForm) => {
      const api = await getApi();
      return api.post<Secret>(`/workspaces/${wsId}/secrets`, { name: values.name.trim(), value: values.value.trim() });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Secret[]>(['secrets', wsId], (prev = []) => [...prev, created]);
      setDialogOpen(false);
      reset();
    },
  });

  const onCreate = handleSubmit((values) => createSecret.mutate(values));

  const deleteSecret = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/secrets/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Secret[]>(['secrets', wsId], (prev = []) => prev.filter((s) => s.id !== id));
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

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
          <h2 className="text-sm font-medium">Secrets</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Encrypted key-value pairs used by integration nodes. Values are
            write-only and never returned by the API.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New secret
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Integration secret names
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "SLACK_TOKEN",
            "GITHUB_TOKEN",
            "NOTION_TOKEN",
            "GMAIL_TOKEN",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
          ].map((n) => (
            <button
              key={n}
              type="button"
<<<<<<< HEAD
              onClick={() => {
                setName(n)
                setDialogOpen(true)
              }}
              className="rounded border bg-background px-2 py-0.5 font-mono text-xs transition-colors hover:bg-muted"
=======
              onClick={() => { setValue('name', n); setDialogOpen(true); }}
              className="font-mono text-xs bg-background border rounded px-2 py-0.5 hover:bg-muted transition-colors"
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Click a name to pre-fill and save it quickly.
        </p>
      </div>

      {secrets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No secrets yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {secrets.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deleteSecret.isPending && deleteSecret.variables === s.id}
                onClick={() => deleteSecret.mutate(s.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

<<<<<<< HEAD
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) {
            setName("")
            setValue("")
            setNameError("")
          }
        }}
      >
=======
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) reset(); }}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add secret</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="OPENAI_API_KEY"
<<<<<<< HEAD
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toUpperCase())
                  setNameError("")
                }}
=======
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                className="font-mono"
                {...register('name', {
                  required: 'Name is required',
                  pattern: { value: /^[A-Z][A-Z0-9_]*$/, message: 'Must be uppercase letters, digits, and underscores' },
                  onChange: (e) => setValue('name', e.target.value.toUpperCase()),
                })}
              />
<<<<<<< HEAD
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Uppercase letters, digits, underscores only.
              </p>
=======
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              <p className="text-xs text-muted-foreground">Uppercase letters, digits, underscores only.</p>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                type="password"
                placeholder="sk-…"
<<<<<<< HEAD
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate()
                }}
=======
                {...register('value', { required: true })}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
              />
              <p className="text-xs text-muted-foreground">
                Stored encrypted. Never retrievable after saving.
              </p>
            </div>
          </form>
          <DialogFooter>
<<<<<<< HEAD
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={saving || !name || !value}
            >
              {saving ? "Saving…" : "Save secret"}
=======
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={onCreate} disabled={createSecret.isPending || !nameValue || !valueValue}>
              {createSecret.isPending ? 'Saving…' : 'Save secret'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
