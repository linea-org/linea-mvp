"use client"

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Copy01Icon,
  Add01Icon,
  Delete01Icon,
  Loading01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  RefreshIcon,
  EyeIcon,
  ViewOffIcon,
  CloudUploadIcon,
  LinkSquare02Icon,
  AiBrain01Icon,
  LockIcon,
  InternetIcon,
} from "@hugeicons/core-free-icons"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Switch } from "@linea/ui/components/switch"
import { Label } from "@linea/ui/components/label"
import { Separator } from "@linea/ui/components/separator"
=======
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon, Copy01Icon, Add01Icon, Delete01Icon, Loading01Icon,
  CheckmarkCircle01Icon, Alert01Icon, RefreshIcon, EyeIcon, ViewOffIcon,
  CloudUploadIcon, LinkSquare02Icon, AiBrain01Icon, LockIcon, InternetIcon,
} from '@hugeicons/core-free-icons';
import { API_ORIGIN } from '@/lib/api';
import { useApiClient } from '@/hooks/use-api-client';
import { Button } from '@linea/ui/components/button';
import { Switch } from '@linea/ui/components/switch';
import { Label } from '@linea/ui/components/label';
import { Separator } from '@linea/ui/components/separator';
import { Spinner } from '@linea/ui/components/spinner';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"

interface Webhook {
  id: string
  workflowId: string
  createdAt: string
}

interface ApiConfig {
  apiEnabled: boolean
  apiVisibility: "api_key" | "public"
  apiKey: string | null
}

interface PanelProps {
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
  workspaceId: string
  podId: string
  workflowId: string
  token: string
  isDeployed: boolean
  deployedAt: string | null
  onDeploy: () => Promise<void>
  onUndeploy: () => Promise<void>
  onClose: () => void
}

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"
const TRIGGER_BASE = `${API_BASE}/v1/webhooks`
=======
  workspaceId: string;
  podId: string;
  workflowId: string;
  isDeployed: boolean;
  deployedAt: string | null;
  onDeploy: () => Promise<void>;
  onUndeploy: () => Promise<void>;
  onClose: () => void;
}

const TRIGGER_BASE = `${API_ORIGIN}/v1/webhooks`;
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx

function DeploySection({
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
  isDeployed,
  deployedAt,
  onDeploy,
  onUndeploy,
  workspaceId,
  podId,
  workflowId,
  token,
}: Pick<
  PanelProps,
  | "isDeployed"
  | "deployedAt"
  | "onDeploy"
  | "onUndeploy"
  | "workspaceId"
  | "podId"
  | "workflowId"
  | "token"
>) {
  const [deploying, setDeploying] = useState(false)
  const [undeploying, setUndeploying] = useState(false)
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null)
  const [apiSaving, setApiSaving] = useState(false)

  useEffect(() => {
    void fetchApiConfig()
  }, [])

  async function fetchApiConfig() {
    try {
      const api = createApiClient(token)
      const data = await api.get<ApiConfig>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`
      )
      setApiConfig(data)
    } catch {
      /* non-critical */
    }
  }

  async function updateApiConfig(patch: Partial<ApiConfig>) {
    if (!apiConfig) return
    const next = { ...apiConfig, ...patch }
    setApiConfig(next)
    setApiSaving(true)
    try {
      const api = createApiClient(token)
      const updated = await api.patch<ApiConfig>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`,
        { apiEnabled: next.apiEnabled, apiVisibility: next.apiVisibility }
      )
      setApiConfig(updated)
    } catch {
      setApiConfig(apiConfig)
    } finally {
      setApiSaving(false)
    }
=======
  isDeployed, deployedAt, onDeploy, onUndeploy,
  workspaceId, podId, workflowId,
}: Pick<PanelProps, 'isDeployed' | 'deployedAt' | 'onDeploy' | 'onUndeploy' | 'workspaceId' | 'podId' | 'workflowId'>) {
  const getApi = useApiClient();
  const [deploying, setDeploying] = useState(false);
  const [undeploying, setUndeploying] = useState(false);
  const queryClient = useQueryClient();
  const apiConfigKey = ['workflow-api-config', workspaceId, podId, workflowId];

  const { data: apiConfig } = useQuery<ApiConfig>({
    queryKey: apiConfigKey,
    queryFn: async () => {
      const api = await getApi();
      return api.get<ApiConfig>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`);
    },
  });

  const updateApiConfigMutation = useMutation({
    mutationFn: async (patch: Partial<ApiConfig>) => {
      const current = queryClient.getQueryData<ApiConfig>(apiConfigKey)!;
      const next = { ...current, ...patch };
      const api = await getApi();
      return api.patch<ApiConfig>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`,
        { apiEnabled: next.apiEnabled, apiVisibility: next.apiVisibility },
      );
    },
    onMutate: async (patch) => {
      const previous = queryClient.getQueryData<ApiConfig>(apiConfigKey);
      if (previous) queryClient.setQueryData(apiConfigKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(apiConfigKey, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(apiConfigKey, data),
  });

  function updateApiConfig(patch: Partial<ApiConfig>) {
    updateApiConfigMutation.mutate(patch);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
  }

  async function handleDeploy() {
    setDeploying(true)
    try {
      await onDeploy()
    } finally {
      setDeploying(false)
    }
  }

  async function handleUndeploy() {
    setUndeploying(true)
    try {
      await onUndeploy()
    } finally {
      setUndeploying(false)
    }
  }

  return (
    <div className="space-y-3 p-4">
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
      {/* Status card */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-3 ${
          isDeployed
            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
            : "border-border bg-muted/30"
        }`}
      >
        <div
          className={`mt-0.5 size-2 shrink-0 rounded-full ${isDeployed ? "bg-green-500" : "bg-muted-foreground/40"}`}
        />
=======
      <div className={`flex items-start gap-3 rounded-lg border p-3 ${
        isDeployed
          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
          : 'border-border bg-muted/30'
      }`}>
        <div className={`mt-0.5 size-2 shrink-0 rounded-full ${isDeployed ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold ${isDeployed ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}
          >
            {isDeployed ? "Live" : "Not deployed"}
          </p>
          {isDeployed && deployedAt ? (
            <p className="mt-0.5 text-[10px] text-green-600 dark:text-green-400">
              Last deployed {new Date(deployedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Deploy to activate scheduled and webhook triggers.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => void handleDeploy()}
          disabled={deploying || undeploying}
        >
          <HugeiconsIcon
            icon={deploying ? Loading01Icon : CloudUploadIcon}
            className={`size-3.5 ${deploying ? "animate-spin" : ""}`}
          />
          {isDeployed ? "Re-deploy" : "Save & Deploy"}
        </Button>
        {isDeployed && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => void handleUndeploy()}
            disabled={undeploying || deploying}
          >
            <HugeiconsIcon
              icon={undeploying ? Loading01Icon : LinkSquare02Icon}
              className={`size-3.5 ${undeploying ? "animate-spin" : ""}`}
            />
            Unpublish
          </Button>
        )}
      </div>

      {isDeployed && (
        <p className="text-[10px] text-muted-foreground">
          Unpublishing disables all triggers. Existing executions are not
          affected.
        </p>
      )}

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
      {/* REST API visibility — surfaced prominently */}
      {apiConfig !== null && (
        <div className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3">
=======
      {apiConfig && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon
                icon={
                  apiConfig.apiEnabled
                    ? apiConfig.apiVisibility === "public"
                      ? InternetIcon
                      : LockIcon
                    : LockIcon
                }
                className={`size-3.5 shrink-0 ${apiConfig.apiEnabled ? "text-primary" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-xs font-medium">REST API access</p>
                <p className="text-[10px] text-muted-foreground">
                  {apiConfig.apiEnabled
                    ? apiConfig.apiVisibility === "api_key"
                      ? "Protected by API key"
                      : "Public — anyone with the URL can trigger"
                    : "Disabled"}
                </p>
              </div>
            </div>
            <Switch
              checked={apiConfig.apiEnabled}
              onCheckedChange={(v) => void updateApiConfig({ apiEnabled: v })}
              disabled={updateApiConfigMutation.isPending}
            />
          </div>

          {apiConfig.apiEnabled && (
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {(["api_key", "public"] as const).map((val) => (
                <label
                  key={val}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] transition-colors ${
                    apiConfig.apiVisibility === val
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="api-visibility-deploy"
                    value={val}
                    checked={apiConfig.apiVisibility === val}
                    onChange={() =>
                      void updateApiConfig({ apiVisibility: val })
                    }
                    className="sr-only"
                  />
                  <HugeiconsIcon
                    icon={val === "api_key" ? LockIcon : InternetIcon}
                    className="size-3 shrink-0"
                  />
                  <span className="font-medium">
                    {val === "api_key" ? "API key" : "Public"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
/* ─── Webhook tab ─────────────────────────────────────────────────── */
function WebhookTab({
  workspaceId,
  podId,
  workflowId,
  token,
}: Omit<
  PanelProps,
  "isDeployed" | "deployedAt" | "onDeploy" | "onUndeploy" | "onClose"
>) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
=======
function WebhookTab({ workspaceId, podId, workflowId }: Omit<PanelProps, 'isDeployed' | 'deployedAt' | 'onDeploy' | 'onUndeploy' | 'onClose'>) {
  const getApi = useApiClient();
  const [copied, setCopied] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const webhooksKey = ['pod-webhooks', workspaceId, podId];

  const { data: webhooks = [], isLoading: loading } = useQuery<Webhook[]>({
    queryKey: webhooksKey,
    queryFn: async () => {
      const api = await getApi();
      return api.get<Webhook[]>(`/workspaces/${workspaceId}/pods/${podId}/webhooks`);
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx

  const workflowWebhooks = webhooks.filter((w) => w.workflowId === workflowId)

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
  useEffect(() => {
    void fetchWebhooks()
  }, [])

  async function fetchWebhooks() {
    try {
      const api = createApiClient(token)
      const data = await api.get<Webhook[]>(
        `/workspaces/${workspaceId}/pods/${podId}/webhooks`
      )
      setWebhooks(data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function createWebhook() {
    setCreating(true)
    try {
      const api = createApiClient(token)
      const created = await api.post<Webhook>(
        `/workspaces/${workspaceId}/pods/${podId}/webhooks`,
        { workflowId }
      )
      setWebhooks((prev) => [...prev, created])
    } catch {
      /* ignore */
    } finally {
      setCreating(false)
    }
  }

  async function deleteWebhook(id: string) {
    try {
      const api = createApiClient(token)
      await api.delete(
        `/workspaces/${workspaceId}/pods/${podId}/webhooks/${id}`
      )
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
    } catch {
      /* ignore */
    }
=======
  const createWebhookMutation = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<Webhook>(`/workspaces/${workspaceId}/pods/${podId}/webhooks`, { workflowId });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Webhook[]>(webhooksKey, (prev) => [...(prev ?? []), created]);
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${workspaceId}/pods/${podId}/webhooks/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Webhook[]>(webhooksKey, (prev) => prev?.filter((w) => w.id !== id) ?? []);
    },
  });

  function createWebhook() {
    createWebhookMutation.mutate();
  }

  function deleteWebhook(id: string) {
    deleteWebhookMutation.mutate(id);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
  }

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      {workflowWebhooks.length === 0 ? (
        <>
          <div className="space-y-1.5 rounded-lg border border-dashed p-4 text-center">
            <p className="text-xs font-medium">No webhook yet</p>
            <p className="text-[11px] text-muted-foreground">
              Create a webhook to trigger this workflow from external systems.
            </p>
          </div>
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
          <Button
            size="sm"
            className="w-full"
            onClick={() => void createWebhook()}
            disabled={creating}
          >
            <HugeiconsIcon
              icon={creating ? Loading01Icon : Add01Icon}
              className={creating ? "animate-spin" : ""}
            />
=======
          <Button size="sm" className="w-full" onClick={createWebhook} disabled={createWebhookMutation.isPending}>
            <HugeiconsIcon icon={createWebhookMutation.isPending ? Loading01Icon : Add01Icon} className={createWebhookMutation.isPending ? 'animate-spin' : ''} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
            Create Webhook
          </Button>
        </>
      ) : (
        <>
          {workflowWebhooks.map((wh) => {
            const triggerUrl = `${TRIGGER_BASE}/${wh.id}/trigger`
            return (
              <div
                key={wh.id}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    ID: {wh.id.slice(0, 8)}…
                  </span>
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-500"
                    onClick={() => void deleteWebhook(wh.id)}
                  >
=======
                  <Button size="icon-xs" variant="ghost" className="text-muted-foreground hover:text-red-500" onClick={() => deleteWebhook(wh.id)}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
                    <HugeiconsIcon icon={Delete01Icon} />
                  </Button>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Trigger URL
                  </p>
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5">
                    <code className="flex-1 truncate font-mono text-[11px]">
                      {triggerUrl}
                    </code>
                    <button
                      onClick={() => copy(triggerUrl, wh.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title="Copy URL"
                    >
                      <HugeiconsIcon
                        icon={
                          copied === wh.id ? CheckmarkCircle01Icon : Copy01Icon
                        }
                        className={`size-3.5 ${copied === wh.id ? "text-green-500" : ""}`}
                      />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Created {new Date(wh.createdAt).toLocaleDateString()}
                </p>
              </div>
            )
          })}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <HugeiconsIcon
                icon={Alert01Icon}
                className="mt-0.5 size-3.5 shrink-0 text-amber-600"
              />
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  HMAC Signing Required
                </p>
                <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Include <code className="font-mono">x-linea-signature</code>{" "}
                  (sha256=…) and{" "}
                  <code className="font-mono">x-webhook-timestamp</code> (Unix
                  seconds, ±5 min).
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
/* ─── REST API tab ────────────────────────────────────────────────── */
function RestApiTab({
  workspaceId,
  podId,
  workflowId,
  token,
}: Omit<
  PanelProps,
  "isDeployed" | "deployedAt" | "onDeploy" | "onUndeploy" | "onClose"
>) {
  const [config, setConfig] = useState<ApiConfig>({
    apiEnabled: false,
    apiVisibility: "api_key",
    apiKey: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [keyVisible, setKeyVisible] = useState(false)

  const endpointUrl = `${API_BASE}/v1/run/${workflowId}`

  useEffect(() => {
    void fetchConfig()
  }, [])

  async function fetchConfig() {
    setLoading(true)
    try {
      const api = createApiClient(token)
      const data = await api.get<ApiConfig>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`
      )
      setConfig(data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function updateConfig(patch: Partial<ApiConfig>) {
    const next = { ...config, ...patch }
    setConfig(next)
    setSaving(true)
    try {
      const api = createApiClient(token)
      const updated = await api.patch<ApiConfig>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`,
        { apiEnabled: next.apiEnabled, apiVisibility: next.apiVisibility }
      )
      setConfig(updated)
    } catch {
      setConfig(config)
    } finally {
      setSaving(false)
    }
  }

  async function rotateKey() {
    setRotating(true)
    try {
      const api = createApiClient(token)
      const res = await api.post<{ apiKey: string }>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api/rotate-key`,
        {}
      )
      setConfig((c) => ({ ...c, apiKey: res.apiKey }))
    } catch {
      /* ignore */
    } finally {
      setRotating(false)
    }
=======
function RestApiTab({ workspaceId, podId, workflowId }: Omit<PanelProps, 'isDeployed' | 'deployedAt' | 'onDeploy' | 'onUndeploy' | 'onClose'>) {
  const getApi = useApiClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const queryClient = useQueryClient();
  const apiConfigKey = ['workflow-api-config', workspaceId, podId, workflowId];

  const { data: config = { apiEnabled: false, apiVisibility: 'api_key' as const, apiKey: null }, isLoading: loading } = useQuery<ApiConfig>({
    queryKey: apiConfigKey,
    queryFn: async () => {
      const api = await getApi();
      return api.get<ApiConfig>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`);
    },
  });

  const endpointUrl = `${API_ORIGIN}/v1/run/${workflowId}`;

  const updateConfigMutation = useMutation({
    mutationFn: async (patch: Partial<ApiConfig>) => {
      const current = queryClient.getQueryData<ApiConfig>(apiConfigKey) ?? config;
      const next = { ...current, ...patch };
      const api = await getApi();
      return api.patch<ApiConfig>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api`,
        { apiEnabled: next.apiEnabled, apiVisibility: next.apiVisibility },
      );
    },
    onMutate: async (patch) => {
      const previous = queryClient.getQueryData<ApiConfig>(apiConfigKey) ?? config;
      queryClient.setQueryData(apiConfigKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(apiConfigKey, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(apiConfigKey, data),
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async () => {
      const api = await getApi();
      return api.post<{ apiKey: string }>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/api/rotate-key`, {});
    },
    onSuccess: (res) => {
      queryClient.setQueryData<ApiConfig>(apiConfigKey, (prev) => prev ? { ...prev, apiKey: res.apiKey } : prev);
    },
  });

  function updateConfig(patch: Partial<ApiConfig>) {
    updateConfigMutation.mutate(patch);
  }

  function rotateKey() {
    rotateKeyMutation.mutate();
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
  }

  function copyText(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const curlCommand =
    config.apiVisibility === "api_key"
      ? `curl -X POST "${endpointUrl}" \\\n  -H "x-api-key: ${config.apiKey ?? "<YOUR_API_KEY>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`
      : `curl -X POST "${endpointUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="cursor-pointer">Enable REST endpoint</Label>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Expose this workflow as an HTTP endpoint
          </p>
        </div>
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
        <Switch
          checked={config.apiEnabled}
          onCheckedChange={(v) => void updateConfig({ apiEnabled: v })}
          disabled={saving}
        />
=======
        <Switch checked={config.apiEnabled} onCheckedChange={(v) => updateConfig({ apiEnabled: v })} disabled={updateConfigMutation.isPending} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
      </div>

      {config.apiEnabled && (
        <>
          <Separator />

          <div className="space-y-2">
            <Label>Access control</Label>
            <div className="space-y-1.5">
              {(["api_key", "public"] as const).map((val) => (
                <label
                  key={val}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 transition-colors hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="rest-visibility-dp"
                    value={val}
                    checked={config.apiVisibility === val}
                    onChange={() => updateConfig({ apiVisibility: val })}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium">
                      {val === "api_key" ? "API key (recommended)" : "Public"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {val === "api_key"
                        ? "Callers must pass x-api-key or Authorization: Bearer"
                        : "Anyone with the URL can trigger this workflow"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-[10px] break-all select-all">
                {endpointUrl}
              </code>
              <button
                onClick={() => copyText(endpointUrl, "url")}
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted/50"
                title="Copy URL"
              >
                <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
              </button>
            </div>
            {copied === "url" && (
              <p className="text-[10px] text-green-600">Copied!</p>
            )}
          </div>

          {config.apiVisibility === "api_key" && (
            <div className="space-y-2">
              <Label>API key</Label>
              {config.apiKey ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-[10px] break-all select-all">
                      {keyVisible
                        ? config.apiKey
                        : `${config.apiKey.slice(0, 8)}${"•".repeat(Math.max(0, config.apiKey.length - 8))}`}
                    </code>
                    <button
                      onClick={() => setKeyVisible((v) => !v)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted/50"
                      title={keyVisible ? "Hide" : "Show"}
                    >
                      <HugeiconsIcon
                        icon={keyVisible ? ViewOffIcon : EyeIcon}
                        className="size-3.5"
                      />
                    </button>
                    <button
                      onClick={() => copyText(config.apiKey!, "key")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted/50"
                      title="Copy"
                    >
                      <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
                    </button>
                  </div>
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
                  {copied === "key" && (
                    <p className="text-[10px] text-green-600">Copied!</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void rotateKey()}
                    disabled={rotating}
                    className="w-full text-xs"
                  >
                    <HugeiconsIcon
                      icon={rotating ? Loading01Icon : RefreshIcon}
                      className={`size-3.5 ${rotating ? "animate-spin" : ""}`}
                    />
=======
                  {copied === 'key' && <p className="text-[10px] text-green-600">Copied!</p>}
                  <Button size="sm" variant="outline" onClick={rotateKey} disabled={rotateKeyMutation.isPending} className="w-full text-xs">
                    <HugeiconsIcon icon={rotateKeyMutation.isPending ? Loading01Icon : RefreshIcon} className={`size-3.5 ${rotateKeyMutation.isPending ? 'animate-spin' : ''}`} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
                    Rotate key
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Rotating invalidates the current key immediately.
                  </p>
                </div>
              ) : (
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void rotateKey()}
                  disabled={rotating}
                  className="w-full text-xs"
                >
                  <HugeiconsIcon
                    icon={rotating ? Loading01Icon : RefreshIcon}
                    className={`size-3.5 ${rotating ? "animate-spin" : ""}`}
                  />
=======
                <Button size="sm" variant="outline" onClick={rotateKey} disabled={rotateKeyMutation.isPending} className="w-full text-xs">
                  <HugeiconsIcon icon={rotateKeyMutation.isPending ? Loading01Icon : RefreshIcon} className={`size-3.5 ${rotateKeyMutation.isPending ? 'animate-spin' : ''}`} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
                  Generate API key
                </Button>
              )}
            </div>
          )}

          <Separator />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>cURL example</Label>
              <button
                onClick={() => copyText(curlCommand, "curl")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                Copy
              </button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap">
              {curlCommand}
            </pre>
            {copied === "curl" && (
              <p className="text-[10px] text-green-600">Copied!</p>
            )}
          </div>

          <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Response
            </p>
            <pre className="font-mono text-[10px] text-foreground/70">{`{ "executionId": "...", "status": "queued" }`}</pre>
            <p className="text-[10px] text-muted-foreground">
              Poll for results:
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] break-all whitespace-pre-wrap">
              {config.apiVisibility === "api_key"
                ? `GET ${endpointUrl}/executions/<executionId>\n  -H "x-api-key: ${config.apiKey ?? "<YOUR_API_KEY>"}"`
                : `GET ${endpointUrl}/executions/<executionId>`}
            </pre>
            <pre className="font-mono text-[10px] text-foreground/70">{`{ "executionId": "...", "status": "completed", "output": ... }`}</pre>
          </div>
        </>
      )}
    </div>
  )
}

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
/* ─── Supervisor model options ────────────────────────────────────── */
const SUPERVISOR_MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 (default — fast)",
    provider: "anthropic",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 (balanced)",
    provider: "anthropic",
  },
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7 (most capable)",
    provider: "anthropic",
  },
  { id: "gpt-4o-mini", label: "GPT-4o Mini (fast)", provider: "openai" },
  { id: "gpt-4o", label: "GPT-4o (balanced)", provider: "openai" },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant (Groq)",
    provider: "groq",
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B (Groq)",
    provider: "groq",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash (Google)",
    provider: "google",
  },
] as const

/* ─── Settings tab ────────────────────────────────────────────────── */
function SettingsTab({
  workspaceId,
  podId,
  workflowId,
  token,
}: Omit<
  PanelProps,
  "isDeployed" | "deployedAt" | "onDeploy" | "onUndeploy" | "onClose"
>) {
  const [supervisorModel, setSupervisorModel] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const api = createApiClient(token)
      const wf = await api.get<{
        definition?: { settings?: { supervisorModel?: string } }
      }>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`)
      setSupervisorModel(wf.definition?.settings?.supervisorModel ?? "")
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function save(model: string) {
    setSupervisorModel(model)
    setSaving(true)
    try {
      const api = createApiClient(token)
      /* Fetch current definition to avoid overwriting other settings */
      const wf = await api.get<{ definition?: Record<string, unknown> }>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`
      )
      const currentDef = wf.definition ?? {}
      const currentSettings =
        (currentDef.settings as Record<string, unknown>) ?? {}
      await api.patch(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`,
        {
          definition: {
            ...currentDef,
            settings: { ...currentSettings, supervisorModel: model || null },
          },
        }
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
=======
interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  tier: 'fast' | 'balanced' | 'powerful' | 'reasoning';
}

function SettingsTab({ workspaceId, podId, workflowId }: Omit<PanelProps, 'isDeployed' | 'deployedAt' | 'onDeploy' | 'onUndeploy' | 'onClose'>) {
  const getApi = useApiClient();
  const [supervisorModel, setSupervisorModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const { data: wf, isLoading: loading } = useQuery<{ definition?: { settings?: { supervisorModel?: string } } }>({
    queryKey: ['workflow-definition-settings', workspaceId, podId, workflowId],
    queryFn: async () => {
      const api = await getApi();
      return api.get(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`);
    },
  });

  const { data: supervisorModels = [] } = useQuery<ModelDefinition[]>({
    queryKey: ['models'],
    queryFn: async () => {
      const api = await getApi();
      return api.get<ModelDefinition[]>('/models');
    },
  });

  if (wf && initializedFor !== workflowId) {
    setInitializedFor(workflowId);
    setSupervisorModel(wf.definition?.settings?.supervisorModel ?? '');
  }

  const saveMutation = useMutation({
    mutationFn: async (model: string) => {
      const api = await getApi();
      const current = await api.get<{ definition?: Record<string, unknown> }>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`,
      );
      const currentDef = current.definition ?? {};
      const currentSettings = (currentDef.settings as Record<string, unknown>) ?? {};
      await api.patch(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`,
        { definition: { ...currentDef, settings: { ...currentSettings, supervisorModel: model || null } } },
      );
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function save(model: string) {
    setSupervisorModel(model);
    saveMutation.mutate(model);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={AiBrain01Icon}
            className="size-4 shrink-0 text-primary"
          />
          <div>
            <Label>Supervisor model</Label>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              LLM used for error-recovery decisions when a node fails. Fast +
              cheap models work best.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
            value={supervisorModel || "__default__"}
            onValueChange={(v) => void save(v === "__default__" ? "" : v)}
            disabled={saving}
=======
            value={supervisorModel || '__default__'}
            onValueChange={(v) => save(v === '__default__' ? '' : v)}
            disabled={saveMutation.isPending}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
          >
            <SelectTrigger className="flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
              <SelectItem value="__default__">
                Platform default (Haiku 4.5)
              </SelectItem>
              {SUPERVISOR_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && (
            <HugeiconsIcon
              icon={Loading01Icon}
              className="size-3.5 shrink-0 animate-spin text-muted-foreground"
            />
          )}
          {saved && (
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              className="size-3.5 shrink-0 text-green-500"
            />
          )}
=======
              <SelectItem value="__default__">Platform default (Haiku 4.5)</SelectItem>
              {supervisorModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name} ({m.tier})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saveMutation.isPending && <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
          {saved && <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5 text-green-500 shrink-0" />}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5 rounded-md border border-border/50 bg-muted/20 p-3">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          About the supervisor
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The supervisor is only invoked when a node fails. It assesses whether
          to retry, skip, or abort — then explains its reasoning in the
          execution log. On the happy path it costs nothing.
        </p>
      </div>
    </div>
  )
}

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
/* ─── Main panel ──────────────────────────────────────────────────── */
type Tab = "webhook" | "rest" | "settings"

export function DeployPanel({
  workspaceId,
  podId,
  workflowId,
  token,
  isDeployed,
  deployedAt,
  onDeploy,
  onUndeploy,
  onClose,
=======
type Tab = 'webhook' | 'rest' | 'settings';

export function DeployPanel({
  workspaceId, podId, workflowId,
  isDeployed, deployedAt, onDeploy, onUndeploy, onClose,
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
}: PanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("webhook")

  const tabs: { id: Tab; label: string }[] = [
    { id: "webhook", label: "Webhook" },
    { id: "rest", label: "REST API" },
    { id: "settings", label: "Settings" },
  ]

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Deploy & Publish</p>
          <p className="text-[11px] text-muted-foreground">
            Deployment and trigger configuration
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <DeploySection
          isDeployed={isDeployed}
          deployedAt={deployedAt}
          onDeploy={onDeploy}
          onUndeploy={onUndeploy}
          workspaceId={workspaceId}
          podId={podId}
          workflowId={workflowId}
        />

        <Separator />

        <div className="px-4 pt-3 pb-1">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground/60 uppercase">
            Triggers
          </p>
        </div>

        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

<<<<<<< HEAD:apps/web/components/workflow-builder/deploy-panel.tsx
        {activeTab === "webhook" ? (
          <WebhookTab
            workspaceId={workspaceId}
            podId={podId}
            workflowId={workflowId}
            token={token}
          />
        ) : activeTab === "rest" ? (
          <RestApiTab
            workspaceId={workspaceId}
            podId={podId}
            workflowId={workflowId}
            token={token}
          />
        ) : (
          <SettingsTab
            workspaceId={workspaceId}
            podId={podId}
            workflowId={workflowId}
            token={token}
          />
=======
        {activeTab === 'webhook' ? (
          <WebhookTab workspaceId={workspaceId} podId={podId} workflowId={workflowId} />
        ) : activeTab === 'rest' ? (
          <RestApiTab workspaceId={workspaceId} podId={podId} workflowId={workflowId} />
        ) : (
          <SettingsTab workspaceId={workspaceId} podId={podId} workflowId={workflowId} />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/deploy-panel.tsx
        )}
      </div>
    </div>
  )
}
