"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Separator } from "@linea/ui/components/separator"
import { Skeleton } from "@linea/ui/components/skeleton"
=======
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useApiClient } from '@/hooks/use-api-client';
import { useMutation } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { Skeleton } from '@linea/ui/components/skeleton';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@linea/ui/components/dialog"

<<<<<<< HEAD
export default function GeneralSettingsPage() {
  const { getToken } = useAuth()
  const {
    activeWorkspace,
    loading: wsLoading,
    removeWorkspace,
  } = useWorkspace()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name)
      setSlug(activeWorkspace.slug)
    }
  }, [activeWorkspace])

  async function handleSave() {
    if (!activeWorkspace) return
    setSaving(true)
    setSaved(false)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.patch(`/workspaces/${activeWorkspace.id}`, { name, slug })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!activeWorkspace) return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await api.delete(`/workspaces/${activeWorkspace.id}`)
      removeWorkspace(activeWorkspace.id)
      window.location.href = "/pods"
    } finally {
      setDeleting(false)
    }
  }
=======
interface GeneralFormValues {
  name: string;
  slug: string;
}

export default function GeneralSettingsPage() {
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading, removeWorkspace } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { isValid } } = useForm<GeneralFormValues>({
    defaultValues: { name: '', slug: '' },
    mode: 'onChange',
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (activeWorkspace) reset({ name: activeWorkspace.name, slug: activeWorkspace.slug });
  }, [activeWorkspace, reset]);

  const saveWorkspace = useMutation({
    mutationFn: async (values: GeneralFormValues) => {
      if (!activeWorkspace) throw new Error('No active workspace');
      const api = await getApi();
      await api.patch(`/workspaces/${activeWorkspace.id}`, values);
    },
    onSuccess: () => setSaved(true),
  });

  const deleteWorkspace = useMutation({
    mutationFn: async () => {
      if (!activeWorkspace) throw new Error('No active workspace');
      const api = await getApi();
      await api.delete(`/workspaces/${activeWorkspace.id}`);
      return activeWorkspace.id;
    },
    onSuccess: (id) => {
      removeWorkspace(id);
      window.location.href = '/pods';
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  function openDeleteDialog() {
    setDeleteConfirmText("")
    setDeleteOpen(true)
  }

<<<<<<< HEAD
  const deleteConfirmed = deleteConfirmText === activeWorkspace?.name
=======
  const deleteConfirmed = deleteConfirmText === activeWorkspace?.name;
  const name = watch('name');
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  if (wsLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit((values) => saveWorkspace.mutate(values))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
<<<<<<< HEAD
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
=======
            {...register('name', {
              required: true,
              onChange: () => setSaved(false),
            })}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input
            id="ws-slug"
<<<<<<< HEAD
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSaved(false)
            }}
=======
            {...register('slug', { onChange: () => setSaved(false) })}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
          />
          <p className="text-xs text-muted-foreground">
            Used in URLs. Only lowercase letters, numbers, and hyphens.
          </p>
        </div>

<<<<<<< HEAD
      <div className="flex items-center gap-3">
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <p className="text-sm text-green-600">Saved!</p>}
      </div>
=======
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saveWorkspace.isPending || !isValid || !name?.trim()}>
            {saveWorkspace.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          {saved && <p className="text-sm text-green-600">Saved!</p>}
        </div>
      </form>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

      <Separator />

      <div className="space-y-3 rounded-lg border border-destructive/40 p-5">
        <div>
          <p className="text-sm font-semibold text-destructive">
            Delete workspace
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes this workspace and everything inside it — pods,
            workflows, executions, secrets, API keys, and all team data. This
            action{" "}
            <span className="font-medium text-foreground">
              cannot be undone
            </span>
            .
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={openDeleteDialog}>
          Delete workspace
        </Button>
      </div>

<<<<<<< HEAD
      {/* Vercel-style delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!deleting) setDeleteOpen(o)
        }}
      >
=======
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleteWorkspace.isPending) setDeleteOpen(o); }}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete workspace
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <strong>Warning:</strong> This will permanently delete{" "}
              <strong>{activeWorkspace?.name}</strong> and all associated data.
              There is no way to recover this workspace.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm-input" className="text-sm">
                Type{" "}
                <span className="font-mono font-semibold">
                  {activeWorkspace?.name}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id="delete-confirm-input"
                placeholder={activeWorkspace?.name ?? ""}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
<<<<<<< HEAD
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirmed) void handleDelete()
                }}
=======
                onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirmed) deleteWorkspace.mutate(); }}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
                autoFocus
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
<<<<<<< HEAD
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
=======
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteWorkspace.isPending}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteWorkspace.mutate()}
              disabled={!deleteConfirmed || deleteWorkspace.isPending}
            >
<<<<<<< HEAD
              {deleting ? "Deleting…" : "Delete workspace"}
=======
              {deleteWorkspace.isPending ? 'Deleting…' : 'Delete workspace'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
