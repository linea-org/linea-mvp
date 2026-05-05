'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
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

const ROLE_BADGE: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  editor: 'outline',
  viewer: 'outline',
};

export default function MembersPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer' | 'admin'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

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
    if (!wsLoading && activeWorkspace) void load();
  }, [activeWorkspace, wsLoading]);

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

  if (wsLoading || loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Members ({members.length})</h2>
          <Button size="sm" onClick={() => setDialogOpen(true)}>Invite member</Button>
        </div>

        <div className="divide-y rounded-lg border">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar className="size-8">
                <AvatarImage src={m.user.avatarUrl ?? undefined} />
                <AvatarFallback>{(m.user.name ?? m.user.email)[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
              </div>
              <Badge variant={ROLE_BADGE[m.role] ?? 'outline'}>{m.role}</Badge>
            </div>
          ))}
        </div>
      </div>

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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void revokeInvite(inv.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
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
    </div>
  );
}
