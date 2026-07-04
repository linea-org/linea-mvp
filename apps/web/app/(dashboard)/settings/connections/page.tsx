"use client"

import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/contexts/workspace-context"
import { useApiClient } from "@/hooks/use-api-client"
import { PageSpinner } from "@linea/ui/components/page-spinner"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@linea/ui/components/native-select"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Badge } from "@linea/ui/components/badge"
import { Separator } from "@linea/ui/components/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@linea/ui/components/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete01Icon,
  Edit01Icon,
  Plug01Icon,
  CheckmarkCircle01Icon,
  LinkSquare01Icon,
} from "@hugeicons/core-free-icons"

interface OAuthConnection {
  id: string
  provider: string
  providerEmail: string | null
  scope: string | null
  expiresAt: string | null
  expired: boolean
  createdAt: string
  updatedAt: string
}

const OAUTH_PROVIDERS = [
  { id: "google", label: "Google", description: "Gmail, Google Sheets, Drive" },
  { id: "slack", label: "Slack", description: "Send messages, read channels" },
  { id: "github", label: "GitHub", description: "Issues, PRs, repositories" },
  { id: "notion", label: "Notion", description: "Read and write Notion pages" },
]

interface ProviderConnection {
  id: string
  provider: string
  createdAt: string
  enabled: boolean
}

interface ModelDefinition {
  id: string
  name: string
  provider: string
}

const AI_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic",
    placeholder: "sk-ant-…",
    field: "apiKey" as const,
  },
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "sk-…",
    field: "apiKey" as const,
  },
  { id: "groq", label: "Groq", placeholder: "gsk_…", field: "apiKey" as const },
  {
    id: "google",
    label: "Google AI",
    placeholder: "AIza…",
    field: "apiKey" as const,
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    placeholder: "xai-…",
    field: "apiKey" as const,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    placeholder: "http://localhost:11434",
    field: "host" as const,
  },
]

interface AIKeyFormState {
  value: string
}

function AIProviderCard({
  wsId,
  provider,
  connection,
  models,
  getApi,
}: {
  wsId: string
  provider: (typeof AI_PROVIDERS)[number]
  connection: ProviderConnection | undefined
  models: ModelDefinition[]
  getApi: ReturnType<typeof useApiClient>
}) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, watch } = useForm<AIKeyFormState>({
    defaultValues: { value: "" },
  })
  const value = watch("value")

  const connect = useMutation({
    mutationFn: async ({ value }: AIKeyFormState) => {
      const api = await getApi()
      if (connection)
        await api.delete(`/workspaces/${wsId}/connections/${connection.id}`)
      const config =
        provider.field === "host"
          ? { host: value.trim() }
          : { apiKey: value.trim() }
      return api.post<ProviderConnection>(
        `/workspaces/${wsId}/connections/${provider.id}`,
        {
          config: JSON.stringify(config),
        }
      )
    },
    onSuccess: (created) => {
      queryClient.setQueryData<ProviderConnection[]>(
        ["connections", wsId],
        (prev = []) => [
          ...prev.filter((c) => c.provider !== provider.id),
          created,
        ]
      )
      reset({ value: "" })
    },
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!connection) return
      const api = await getApi()
      await api.delete(`/workspaces/${wsId}/connections/${connection.id}`)
      return connection.id
    },
    onSuccess: (id) => {
      if (!id) return
      queryClient.setQueryData<ProviderConnection[]>(
        ["connections", wsId],
        (prev = []) => prev.filter((c) => c.id !== id)
      )
    },
  })

  const providerModels = models.filter((m) => m.provider === provider.id)
  const onSave = handleSubmit((values) => connect.mutate(values))

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{provider.label}</p>
            {connection ? (
              <Badge variant="default" className="text-[10px]">
                connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                not set
              </Badge>
            )}
          </div>
          {providerModels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {providerModels.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {m.name}
                </span>
              ))}
            </div>
          )}
          {connection && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Set {new Date(connection.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {connection && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-xs text-destructive hover:text-destructive"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {disconnect.isPending ? "Removing…" : "Remove"}
          </Button>
        )}
      </div>

      <form onSubmit={onSave} className="flex gap-2">
        <Input
          type={provider.field === "host" ? "text" : "password"}
          placeholder={
            connection
              ? "••••••••••••  (re-enter to rotate)"
              : provider.placeholder
          }
          className="flex-1 font-mono text-sm"
          {...register("value")}
        />
        <Button
          size="sm"
          className="self-end"
          type="submit"
          disabled={!value.trim() || connect.isPending}
        >
          {connect.isPending ? "Saving…" : connection ? "Rotate" : "Save"}
        </Button>
      </form>
    </div>
  )
}

interface McpServer {
  id: string
  name: string
  url: string
  authType: "none" | "api_key" | "bearer" | "oauth"
  status: "unknown" | "connected" | "error"
  hasToken: boolean
  createdAt: string
}

interface FormState {
  name: string
  url: string
  authType: "none" | "api_key" | "bearer" | "oauth"
  accessToken: string
}

const BLANK: FormState = {
  name: "",
  url: "",
  authType: "none",
  accessToken: "",
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  connected: "default",
  error: "destructive",
  unknown: "outline",
}

function ConnectionsPageInner() {
  const getApi = useApiClient()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const wsId = activeWorkspace?.id ?? ""
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<McpServer | null>(null)
  const { register, handleSubmit, reset, watch } = useForm<FormState>({
    defaultValues: BLANK,
  })

  const { data: servers = [], isLoading: loading } = useQuery<McpServer[]>({
    queryKey: ["mcp-servers", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<McpServer[]>(`/workspaces/${wsId}/mcp-servers`)
    },
  })

  const { data: oauthConnections = [], isLoading: oauthLoading } = useQuery<
    OAuthConnection[]
  >({
    queryKey: ["oauth-connections", wsId, searchParams.get("connected")],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<OAuthConnection[]>(`/workspaces/${wsId}/oauth/connections`)
    },
  })

  const {
    data: providerConnections = [],
    isLoading: providerConnectionsLoading,
  } = useQuery<ProviderConnection[]>({
    queryKey: ["connections", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<ProviderConnection[]>(`/workspaces/${wsId}/connections`)
    },
  })

  const { data: models = [] } = useQuery<ModelDefinition[]>({
    queryKey: ["models"],
    queryFn: async () => {
      const api = await getApi()
      return api.get<ModelDefinition[]>("/models")
    },
  })

  const saveServer = useMutation({
    mutationFn: async (values: FormState) => {
      const api = await getApi()
      const body: Record<string, string> = {
        name: values.name.trim(),
        url: values.url.trim(),
        authType: values.authType,
      }
      if (values.accessToken.trim())
        body.accessToken = values.accessToken.trim()
      return editTarget
        ? api.patch<McpServer>(
            `/workspaces/${wsId}/mcp-servers/${editTarget.id}`,
            body
          )
        : api.post<McpServer>(`/workspaces/${wsId}/mcp-servers`, body)
    },
    onSuccess: (result) => {
      queryClient.setQueryData<McpServer[]>(
        ["mcp-servers", wsId],
        (prev = []) =>
          editTarget
            ? prev.map((s) => (s.id === result.id ? result : s))
            : [result, ...prev]
      )
      setDialogOpen(false)
    },
  })

  const deleteServer = useMutation({
    mutationFn: async (server: McpServer) => {
      const api = await getApi()
      await api.delete(`/workspaces/${wsId}/mcp-servers/${server.id}`)
      return server.id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<McpServer[]>(
        ["mcp-servers", wsId],
        (prev = []) => prev.filter((s) => s.id !== id)
      )
    },
  })

  const disconnectOAuth = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi()
      await api.delete(`/workspaces/${wsId}/oauth/connections/${id}`)
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<OAuthConnection[]>(
        ["oauth-connections", wsId, searchParams.get("connected")],
        (prev = []) => prev.filter((c) => c.id !== id)
      )
    },
  })

  function openCreate() {
    setEditTarget(null)
    reset(BLANK)
    setDialogOpen(true)
  }

  function openEdit(server: McpServer) {
    setEditTarget(server)
    reset({
      name: server.name,
      url: server.url,
      authType: server.authType,
      accessToken: "",
    })
    setDialogOpen(true)
  }

  async function handleConnectOAuth(provider: string) {
    if (!activeWorkspace) return
    const api = await getApi()
    const data = await api.get<{ url: string }>(
      `/workspaces/${activeWorkspace.id}/oauth/${provider}/connect-url`
    )
    window.location.href = data.url
  }

  const authType = watch("authType")
  const nameValue = watch("name")
  const urlValue = watch("url")
  const needsToken = authType !== "none"
  const onSave = handleSubmit((values) => saveServer.mutate(values))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">MCP Connections</h2>
          <p className="text-sm text-muted-foreground">
            Connect Model Context Protocol servers to use as tools in your
            workflows.
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
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HugeiconsIcon
            icon={Plug01Icon}
            className="mx-auto mb-3 size-8 text-muted-foreground"
          />
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
            <div
              key={server.id}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <HugeiconsIcon
                  icon={Plug01Icon}
                  className="size-4 text-muted-foreground"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{server.name}</p>
                  <Badge
                    variant={STATUS_VARIANT[server.status] ?? "outline"}
                    className="text-[10px]"
                  >
                    {server.status}
                  </Badge>
                  {server.hasToken && (
                    <Badge variant="secondary" className="text-[10px]">
                      token set
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {server.url}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => openEdit(server)}
                >
                  <HugeiconsIcon icon={Edit01Icon} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  disabled={
                    deleteServer.isPending &&
                    deleteServer.variables?.id === server.id
                  }
                  onClick={() => deleteServer.mutate(server)}
                >
                  <HugeiconsIcon icon={Delete01Icon} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Separator />

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Connected Apps</h2>
          <p className="text-sm text-muted-foreground">
            OAuth integrations for use in Slack, GitHub, Gmail, and Notion
            workflow nodes.
          </p>
        </div>

        {searchParams.get("connected") && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              className="size-4 shrink-0 text-green-600"
            />
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong className="capitalize">
                {searchParams.get("connected")}
              </strong>{" "}
              connected successfully.
            </p>
          </div>
        )}

        {oauthLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {OAUTH_PROVIDERS.map((provider) => {
              const conn = oauthConnections.find(
                (c) => c.provider === provider.id
              )
              return (
                <div
                  key={provider.id}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{provider.label}</p>
                      {conn && !conn.expired && (
                        <Badge variant="default" className="text-[10px]">
                          connected
                        </Badge>
                      )}
                      {conn?.expired && (
                        <Badge variant="destructive" className="text-[10px]">
                          expired
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {conn?.providerEmail ?? provider.description}
                    </p>
                  </div>
                  {conn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        disconnectOAuth.isPending &&
                        disconnectOAuth.variables === conn.id
                      }
                      onClick={() => disconnectOAuth.mutate(conn.id)}
                    >
                      <HugeiconsIcon
                        icon={Delete01Icon}
                        className="mr-1.5 size-3.5"
                      />
                      {disconnectOAuth.isPending &&
                      disconnectOAuth.variables === conn.id
                        ? "Disconnecting…"
                        : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnectOAuth(provider.id)}
                    >
                      <HugeiconsIcon
                        icon={LinkSquare01Icon}
                        className="mr-1.5 size-3.5"
                      />
                      Connect
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">AI Model Keys</h2>
          <p className="text-sm text-muted-foreground">
            Add API keys for AI model providers. Keys are stored encrypted and
            used by Agent nodes when selecting a model.
          </p>
        </div>

        {providerConnectionsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {AI_PROVIDERS.map((provider) => (
              <AIProviderCard
                key={provider.id}
                wsId={wsId}
                provider={provider}
                connection={providerConnections.find(
                  (c) => c.provider === provider.id
                )}
                models={models}
                getApi={getApi}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit connection" : "Add MCP connection"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Firecrawl, Browserbase"
                autoFocus
                {...register("name")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Server URL</Label>
              <Input
                placeholder="https://mcp.example.com"
                {...register("url")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auth type</Label>
              <NativeSelect className="w-full" {...register("authType")}>
                <NativeSelectOption value="none">None</NativeSelectOption>
                <NativeSelectOption value="bearer">
                  Bearer token
                </NativeSelectOption>
                <NativeSelectOption value="api_key">API key</NativeSelectOption>
                <NativeSelectOption value="oauth">OAuth</NativeSelectOption>
              </NativeSelect>
            </div>
            {needsToken && (
              <div className="space-y-1.5">
                <Label>
                  Access token{" "}
                  {editTarget?.hasToken && (
                    <span className="text-muted-foreground">
                      (leave blank to keep existing)
                    </span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    editTarget?.hasToken ? "••••••••" : "Paste token…"
                  }
                  {...register("accessToken")}
                />
              </div>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={
                !nameValue.trim() || !urlValue.trim() || saveServer.isPending
              }
            >
              {saveServer.isPending
                ? "Saving…"
                : editTarget
                  ? "Update"
                  : "Add connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ConnectionsPageInner />
    </Suspense>
  )
}
