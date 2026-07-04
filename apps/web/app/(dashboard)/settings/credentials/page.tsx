"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useApiClient } from "@/hooks/use-api-client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/contexts/workspace-context"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Skeleton } from "@linea/ui/components/skeleton"
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
  const getApi = useApiClient()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const queryClient = useQueryClient()
  const wsId = activeWorkspace?.id ?? ""
  const [dialogOpen, setDialogOpen] = useState(false)

  interface SecretForm {
    name: string
    value: string
  }
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SecretForm>({
    defaultValues: { name: "", value: "" },
  })
  const nameValue = watch("name")
  const valueValue = watch("value")

  const { data: secrets = [], isLoading: loading } = useQuery<Secret[]>({
    queryKey: ["secrets", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<Secret[]>(`/workspaces/${wsId}/secrets`)
    },
  })

  const createSecret = useMutation({
    mutationFn: async (values: SecretForm) => {
      const api = await getApi()
      return api.post<Secret>(`/workspaces/${wsId}/secrets`, {
        name: values.name.trim(),
        value: values.value.trim(),
      })
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Secret[]>(["secrets", wsId], (prev = []) => [
        ...prev,
        created,
      ])
      setDialogOpen(false)
      reset()
    },
  })

  const onCreate = handleSubmit((values) => createSecret.mutate(values))

  const deleteSecret = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi()
      await api.delete(`/workspaces/${wsId}/secrets/${id}`)
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Secret[]>(["secrets", wsId], (prev = []) =>
        prev.filter((s) => s.id !== id)
      )
    },
  })

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
              onClick={() => {
                setValue("name", n)
                setDialogOpen(true)
              }}
              className="rounded border bg-background px-2 py-0.5 font-mono text-xs transition-colors hover:bg-muted"
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
                disabled={
                  deleteSecret.isPending && deleteSecret.variables === s.id
                }
                onClick={() => deleteSecret.mutate(s.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add secret</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="OPENAI_API_KEY"
                className="font-mono"
                {...register("name", {
                  required: "Name is required",
                  pattern: {
                    value: /^[A-Z][A-Z0-9_]*$/,
                    message:
                      "Must be uppercase letters, digits, and underscores",
                  },
                  onChange: (e) =>
                    setValue("name", e.target.value.toUpperCase()),
                })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Uppercase letters, digits, underscores only.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                type="password"
                placeholder="sk-…"
                {...register("value", { required: true })}
              />
              <p className="text-xs text-muted-foreground">
                Stored encrypted. Never retrievable after saving.
              </p>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={createSecret.isPending || !nameValue || !valueValue}
            >
              {createSecret.isPending ? "Saving…" : "Save secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
