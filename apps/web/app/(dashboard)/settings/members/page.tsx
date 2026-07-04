"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/contexts/workspace-context"
import { useApiClient } from "@/hooks/use-api-client"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Badge } from "@linea/ui/components/badge"
import { Skeleton } from "@linea/ui/components/skeleton"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@linea/ui/components/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@linea/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@linea/ui/components/dropdown-menu"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreVerticalIcon,
  Delete01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons"

interface Member {
  userId: string
  role: string
  joinedAt: string
  user: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
  }
}

interface Invite {
  id: string
  email: string | null
  role: string
  token: string
  expiresAt: string
}

type MemberRole = "owner" | "admin" | "editor" | "viewer"

interface InviteFormValues {
  email: string
  role: "editor" | "viewer" | "admin"
}

interface RoleFormValues {
  role: MemberRole
}

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  editor: "outline",
  viewer: "outline",
}

const ROLE_LEVEL: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

function canManage(actorRole: string, targetRole: string) {
  return (ROLE_LEVEL[actorRole] ?? 0) > (ROLE_LEVEL[targetRole] ?? 0)
}

export default function MembersPage() {
  const getApi = useApiClient()
  const { user: clerkUser } = useUser()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const queryClient = useQueryClient()
  const wsId = activeWorkspace?.id ?? ""
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const inviteForm = useForm<InviteFormValues>({
    defaultValues: { email: "", role: "editor" },
  })

  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState<Member | null>(null)
  const roleForm = useForm<RoleFormValues>({
    defaultValues: { role: "editor" },
  })
  const currentNewRole = roleForm.watch("role")

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<Member[]>(`/workspaces/${wsId}/members`)
    },
  })

  const { data: invites = [], isLoading: invitesLoading } = useQuery<Invite[]>({
    queryKey: ["invites", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<Invite[]>(`/workspaces/${wsId}/invites`)
    },
  })

  const loading = membersLoading || invitesLoading

  const myEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
  const me = members.find((m) => m.user.email === myEmail)
  const myRole = me?.role ?? "viewer"
  const isAdmin = (ROLE_LEVEL[myRole] ?? 0) >= (ROLE_LEVEL["admin"] ?? 0)

  const inviteMember = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const api = await getApi()
      return api.post<Invite>(`/workspaces/${wsId}/invites`, {
        email: values.email || undefined,
        role: values.role,
      })
    },
    onSuccess: (invite) => {
      setInviteLink(`${window.location.origin}/invite/${invite.token}`)
      queryClient.setQueryData<Invite[]>(["invites", wsId], (prev = []) => [
        ...prev,
        invite,
      ])
      inviteForm.setValue("email", "")
    },
  })

  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const api = await getApi()
      await api.delete(`/workspaces/${wsId}/invites/${inviteId}`)
      return inviteId
    },
    onSuccess: (inviteId) => {
      queryClient.setQueryData<Invite[]>(["invites", wsId], (prev = []) =>
        prev.filter((i) => i.id !== inviteId)
      )
    },
  })

  function openRoleDialog(member: Member) {
    setRoleTarget(member)
    roleForm.reset({ role: member.role as MemberRole })
    setRoleDialogOpen(true)
  }

  const changeRole = useMutation({
    mutationFn: async (values: RoleFormValues) => {
      if (!roleTarget) throw new Error("No target selected")
      const api = await getApi()
      await api.patch(`/workspaces/${wsId}/members/${roleTarget.userId}`, {
        role: values.role,
      })
      return { userId: roleTarget.userId, role: values.role }
    },
    onSuccess: ({ userId, role }) => {
      queryClient.setQueryData<Member[]>(["members", wsId], (prev = []) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      )
      setRoleDialogOpen(false)
    },
  })

  const removeMember = useMutation({
    mutationFn: async (member: Member) => {
      const api = await getApi()
      await api.delete(`/workspaces/${wsId}/members/${member.userId}`)
      return member.userId
    },
    onSuccess: (userId) => {
      queryClient.setQueryData<Member[]>(["members", wsId], (prev = []) =>
        prev.filter((m) => m.userId !== userId)
      )
    },
  })

  if (wsLoading || loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Members ({members.length})</h2>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Invite member
            </Button>
          )}
        </div>

        <div className="divide-y rounded-lg border">
          {members.map((m) => {
            const isMe = m.user.email === myEmail
            const manageable = isAdmin && !isMe && canManage(myRole, m.role)
            return (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={m.user.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    {(m.user.name ?? m.user.email)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.name ?? m.user.email}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.user.email}
                  </p>
                </div>
                <Badge variant={ROLE_BADGE[m.role] ?? "outline"}>
                  {m.role}
                </Badge>
                {manageable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={
                          removeMember.isPending &&
                          removeMember.variables?.userId === m.userId
                        }
                      >
                        <HugeiconsIcon icon={MoreVerticalIcon} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openRoleDialog(m)}>
                        <HugeiconsIcon
                          icon={UserEdit01Icon}
                          className="mr-2 size-4"
                        />
                        Change role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => removeMember.mutate(m)}
                      >
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          className="mr-2 size-4"
                        />
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Pending invites</h2>
          <div className="divide-y rounded-lg border">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{inv.email ?? "Any email"}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">{inv.role}</Badge>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeInvite.mutate(inv.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setInviteLink(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Share this invite link:
              </p>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <form
              id="invite-member-form"
              onSubmit={inviteForm.handleSubmit((values) =>
                inviteMember.mutate(values)
              )}
              className="space-y-4 py-2"
            >
              <div className="space-y-1.5">
                <Label>Email (optional)</Label>
                <Input
                  placeholder="colleague@company.com"
                  {...inviteForm.register("email")}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to create a general invite link.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Controller
                  control={inviteForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          Viewer — read only
                        </SelectItem>
                        <SelectItem value="editor">
                          Editor — can create and run workflows
                        </SelectItem>
                        <SelectItem value="admin">
                          Admin — full access except billing
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </form>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setInviteLink(null)
              }}
            >
              {inviteLink ? "Done" : "Cancel"}
            </Button>
            {!inviteLink && (
              <Button
                type="submit"
                form="invite-member-form"
                disabled={inviteMember.isPending}
              >
                {inviteMember.isPending ? "Creating…" : "Create invite"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
          </DialogHeader>
          <form
            id="change-role-form"
            onSubmit={roleForm.handleSubmit((values) =>
              changeRole.mutate(values)
            )}
            className="space-y-3 py-2"
          >
            <p className="text-sm text-muted-foreground">
              Changing role for{" "}
              <span className="font-medium text-foreground">
                {roleTarget?.user.name ?? roleTarget?.user.email}
              </span>
            </p>
            <Controller
              control={roleForm.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer — read only</SelectItem>
                    <SelectItem value="editor">
                      Editor — can create and run workflows
                    </SelectItem>
                    {myRole === "owner" && (
                      <SelectItem value="admin">
                        Admin — full access except billing
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="change-role-form"
              disabled={
                changeRole.isPending || currentNewRole === roleTarget?.role
              }
            >
              {changeRole.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
