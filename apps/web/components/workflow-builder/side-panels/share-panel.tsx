"use client"

<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading01Icon,
  UserAdd01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons"
import { createApiClient, friendlyApiError } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { ScrollArea } from "@linea/ui/components/scroll-area"
=======
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon, Loading01Icon, UserAdd01Icon, Delete01Icon,
} from '@hugeicons/core-free-icons';
import { friendlyApiError } from '@/lib/api';
import { useApiClient } from '@/hooks/use-api-client';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { Spinner } from '@linea/ui/components/spinner';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"

interface Props {
<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
  workspaceId: string
  podId: string
  workflowId: string
  token: string
  onClose: () => void
=======
  workspaceId: string;
  podId: string;
  workflowId: string;
  onClose: () => void;
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx
}

interface Member {
  userId: string
  role: string
  user: { name: string | null; email: string }
}

interface Invite {
  id: string
  email: string
  role: string
  expiresAt: string
}

interface InviteFormValues {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
}

const ROLE_BADGE: Record<string, string> = {
  owner:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  editor:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  viewer: "bg-muted text-muted-foreground",
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (email[0]?.toUpperCase() ?? "?")
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {initials}
    </div>
  )
}

<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
export function SharePanel({
  workspaceId,
  podId,
  workflowId,
  token,
  onClose,
}: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const api = createApiClient(token)
      const [membersData, invitesData] = await Promise.all([
        api.get<Member[]>(`/workspaces/${workspaceId}/members`),
        api
          .get<Invite[]>(`/workspaces/${workspaceId}/invites`)
          .catch(() => [] as Invite[]),
      ])
      setMembers(Array.isArray(membersData) ? membersData : [])
      setInvites(Array.isArray(invitesData) ? invitesData : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function sendInvite() {
    if (!email.trim()) return
    setSending(true)
    setSendError("")
    try {
      const api = createApiClient(token)
      const invite = await api.post<Invite>(
        `/workspaces/${workspaceId}/invites`,
        { email: email.trim(), role }
      )
      setInvites((prev) => [...prev, invite])
      setEmail("")
    } catch (err) {
      setSendError(friendlyApiError(err))
    } finally {
      setSending(false)
    }
  }

  async function revokeInvite(inviteId: string) {
    try {
      const api = createApiClient(token)
      await api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`)
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } catch {
      // ignore
    }
  }
=======
export function SharePanel({ workspaceId, podId, workflowId, onClose }: Props) {
  const queryClient = useQueryClient();
  const getApi = useApiClient();
  const shareKey = ['workspace-share', workspaceId];

  const { control, handleSubmit, watch, reset } = useForm<InviteFormValues>({
    defaultValues: { email: '', role: 'editor' },
  });
  const email = watch('email');

  const { data, isLoading: loading } = useQuery({
    queryKey: shareKey,
    queryFn: async () => {
      const api = await getApi();
      const [membersData, invitesData] = await Promise.all([
        api.get<Member[]>(`/workspaces/${workspaceId}/members`),
        api.get<Invite[]>(`/workspaces/${workspaceId}/invites`).catch(() => [] as Invite[]),
      ]);
      return {
        members: Array.isArray(membersData) ? membersData : [],
        invites: Array.isArray(invitesData) ? invitesData : [],
      };
    },
  });
  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  const sendInviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const api = await getApi();
      return api.post<Invite>(`/workspaces/${workspaceId}/invites`, { email: values.email.trim(), role: values.role });
    },
    onSuccess: (invite) => {
      queryClient.setQueryData(shareKey, (prev: { members: Member[]; invites: Invite[] } | undefined) =>
        prev ? { ...prev, invites: [...prev.invites, invite] } : prev,
      );
      reset();
    },
    meta: { skipGlobalErrorToast: true },
  });
  const sendError = sendInviteMutation.error ? friendlyApiError(sendInviteMutation.error) : '';
  const onSubmitInvite = handleSubmit((values) => sendInviteMutation.mutate(values));

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
      return inviteId;
    },
    onSuccess: (inviteId) => {
      queryClient.setQueryData(shareKey, (prev: { members: Member[]; invites: Invite[] } | undefined) =>
        prev ? { ...prev, invites: prev.invites.filter((i) => i.id !== inviteId) } : prev,
      );
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Share & collaborate</p>
          <p className="text-[11px] text-muted-foreground">
            Manage workspace access
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
          {/* Invite by email */}
=======

>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Invite people
            </p>
            <div className="flex gap-2">
<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
              <Input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSendError("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendInvite()
                }}
                placeholder="Email address"
                type="email"
                className="h-8 flex-1 text-xs"
              />
              <Select
                value={role}
                onValueChange={(v) => setRole(v as typeof role)}
              >
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
=======
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    {...field}
                    onKeyDown={(e) => { if (e.key === 'Enter') void onSubmitInvite(); }}
                    placeholder="Email address"
                    type="email"
                    className="flex-1 text-xs h-8"
                  />
                )}
              />
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx
            </div>
            {sendError && (
              <p className="text-[11px] text-destructive">{sendError}</p>
            )}
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={() => void onSubmitInvite()}
              disabled={sendInviteMutation.isPending || !email.trim()}
            >
<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
              {sending ? (
                <HugeiconsIcon
                  icon={Loading01Icon}
                  className="size-3.5 animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={UserAdd01Icon} className="size-3.5" />
              )}
=======
              {sendInviteMutation.isPending
                ? <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin" />
                : <HugeiconsIcon icon={UserAdd01Icon} className="size-3.5" />}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx
              Send invite
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Members with access
            </p>
            {loading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
<<<<<<< HEAD:apps/web/components/workflow-builder/share-panel.tsx
                <HugeiconsIcon
                  icon={Loading01Icon}
                  className="size-3.5 animate-spin"
                />
=======
                <Spinner className="size-3.5" />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/share-panel.tsx
                Loading…
              </div>
            ) : members.length === 0 ? (
              <p className="text-xs text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-1">
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <Avatar name={m.user.name} email={m.user.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">
                        {m.user.name ?? m.user.email}
                      </p>
                      {m.user.name && (
                        <p className="truncate text-[10px] text-muted-foreground">
                          {m.user.email}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${ROLE_BADGE[m.role] ?? ROLE_BADGE.viewer}`}
                    >
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {invites.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Pending invites
              </p>
              <div className="space-y-1">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground">
                      ?
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-foreground">
                        {inv.email}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {inv.role} · pending
                      </p>
                    </div>
                    <button
                      onClick={() => revokeInviteMutation.mutate(inv.id)}
                      title="Revoke invite"
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
