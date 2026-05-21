'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@linea/ui/components/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon, Delete01Icon, UserEdit01Icon } from '@hugeicons/core-free-icons';

interface Member {
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
}

interface Invite {
  id: string;
  email: string | null;
  role: string;
  token: string;
  expiresAt: string;
}

type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

const ROLE_BADGE: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  editor: 'outline',
  viewer: 'outline',
};

const ROLE_LEVEL: Record<string, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };

function canManage(actorRole: string, targetRole: string) {
  return (ROLE_LEVEL[actorRole] ?? 0) > (ROLE_LEVEL[targetRole] ?? 0);
}

export default function MembersPage() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer' | 'admin'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Role change state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<MemberRole>('editor');
  const [savingRole, setSavingRole] = useState(false);

  // Remove state
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const [m, i] = await Promise.all([
        api.get<Member[]>(`/workspaces/${activeWorkspace.id}/members`),
        api.get<Invite[]>(`/workspaces/${activeWorkspace.id}/invites`),
      ]);
      setMembers(m);
      setInvites(i);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading]);

  // Derive current user's role from the members list
  const myEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const me = members.find((m) => m.user.email === myEmail);
  const myRole = me?.role ?? 'viewer';
  const isAdmin = (ROLE_LEVEL[myRole] ?? 0) >= (ROLE_LEVEL['admin'] ?? 0);

  async function handleInvite() {
    if (!activeWorkspace) return;
    setInviting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const invite = await api.post<Invite>(`/workspaces/${activeWorkspace.id}/invites`, {
        email: inviteEmail || undefined,
        role: inviteRole,
      });
      const link = `${window.location.origin}/invite/${invite.token}`;
      setInviteLink(link);
      setInvites((prev) => [...prev, invite]);
      setInviteEmail('');
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    await api.delete(`/workspaces/${activeWorkspace.id}/invites/${inviteId}`);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  function openRoleDialog(member: Member) {
    setRoleTarget(member);
    setNewRole(member.role as MemberRole);
    setRoleDialogOpen(true);
  }

  async function handleRoleChange() {
    if (!activeWorkspace || !roleTarget) return;
    setSavingRole(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/workspaces/${activeWorkspace.id}/members/${roleTarget.userId}`, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => m.userId === roleTarget.userId ? { ...m, role: newRole } : m),
      );
      setRoleDialogOpen(false);
    } finally {
      setSavingRole(false);
    }
  }

  async function handleRemoveMember(member: Member) {
    if (!activeWorkspace) return;
    setRemoving(member.userId);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/members/${member.userId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    } finally {
      setRemoving(null);
    }
  }

  if (wsLoading || loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Members ({members.length})</h2>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>Invite member</Button>
          )}
        </div>

        <div className="divide-y rounded-lg border">
          {members.map((m) => {
            const isMe = m.user.email === myEmail;
            const manageable = isAdmin && !isMe && canManage(myRole, m.role);
            return (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={m.user.avatarUrl ?? undefined} />
                  <AvatarFallback>{(m.user.name ?? m.user.email)[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.user.name ?? m.user.email}
                    {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                </div>
                <Badge variant={ROLE_BADGE[m.role] ?? 'outline'}>{m.role}</Badge>
                {manageable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" disabled={removing === m.userId}>
                        <HugeiconsIcon icon={MoreVerticalIcon} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openRoleDialog(m)}>
                        <HugeiconsIcon icon={UserEdit01Icon} className="mr-2 size-4" />
                        Change role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => void handleRemoveMember(m)}
                      >
                        <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Pending invites</h2>
          <div className="divide-y rounded-lg border">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{inv.email ?? 'Any email'}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">{inv.role}</Badge>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void revokeInvite(inv.id)}
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

      {/* Invite dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setInviteLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Share this invite link:</p>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="font-mono text-xs" />
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
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Email (optional)</Label>
                <Input
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave blank to create a general invite link.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer — read only</SelectItem>
                    <SelectItem value="editor">Editor — can create and run workflows</SelectItem>
                    <SelectItem value="admin">Admin — full access except billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setInviteLink(null); }}>
              {inviteLink ? 'Done' : 'Cancel'}
            </Button>
            {!inviteLink && (
              <Button onClick={() => void handleInvite()} disabled={inviting}>
                {inviting ? 'Creating…' : 'Create invite'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role change dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Changing role for <span className="font-medium text-foreground">{roleTarget?.user.name ?? roleTarget?.user.email}</span>
            </p>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer — read only</SelectItem>
                <SelectItem value="editor">Editor — can create and run workflows</SelectItem>
                {myRole === 'owner' && (
                  <SelectItem value="admin">Admin — full access except billing</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleRoleChange()} disabled={savingRole || newRole === roleTarget?.role}>
              {savingRole ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
