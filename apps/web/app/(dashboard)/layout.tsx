'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk, useUser, useAuth } from '@clerk/nextjs';
import { WorkspaceProvider, useWorkspace } from '@/contexts/workspace-context';
import { PodProvider, usePod } from '@/contexts/space-context';
import { WelcomeModal } from '@/components/onboarding/welcome-modal';
import { GettingStarted } from '@/components/onboarding/getting-started';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { createApiClient } from '@/lib/api';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@linea/ui/components/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@linea/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@linea/ui/components/dropdown-menu';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Button } from '@linea/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  FlowCircleIcon,
  Settings01Icon,
  ArrowDown01Icon,
  Logout03Icon,
  Database01Icon,
  Notification01Icon,
  Calendar01Icon,
  LinkSquare01Icon,
  Add01Icon,
  Analytics02Icon,
  GridViewIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons';

function PodSwitcher() {
  const { pods, activePod, setActivePod, loading } = usePod();

  if (loading) return <div className="h-7 w-32 animate-pulse rounded bg-muted" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors max-w-48">
          <span className="truncate font-medium text-sm">
            {activePod?.name ?? 'Select pod'}
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {pods.length === 0 ? (
          <DropdownMenuItem disabled>No pods yet</DropdownMenuItem>
        ) : (
          pods.map((pod) => (
            <DropdownMenuItem key={pod.id} onClick={() => setActivePod(pod)}>
              {pod.name}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/pods">Manage pods</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DashboardSidebar() {
  const pathname = usePathname();
  const { workspaces, activeWorkspace, setActiveWorkspace, addWorkspace, loading: wsLoading } = useWorkspace();
  const { activePod } = usePod();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  async function handleCreateWorkspace() {
    if (!wsName.trim()) return;
    setCreatingWs(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const ws = await api.post<{ id: string; name: string; slug: string; plan: string }>(
        '/workspaces',
        { name: wsName.trim() },
      );
      addWorkspace(ws);
      setWsDialogOpen(false);
      setWsName('');
    } finally {
      setCreatingWs(false);
    }
  }

  const podBase = activePod ? `/pods/${activePod.id}` : null;

  const navItems = [
    { href: podBase ? `${podBase}/workflows`  : '/pods', label: 'Workflows',  icon: WorkflowSquare01Icon, disabled: !podBase },
    { href: podBase ? `${podBase}/executions` : '/pods', label: 'Executions', icon: FlowCircleIcon,        disabled: !podBase },
    { href: podBase ? `${podBase}/schedules`  : '/pods', label: 'Schedules',  icon: Calendar01Icon,        disabled: !podBase },
    { href: podBase ? `${podBase}/webhooks`   : '/pods', label: 'Webhooks',   icon: LinkSquare01Icon,      disabled: !podBase },
    { href: '/knowledge',  label: 'Knowledge',  icon: Database01Icon,  disabled: false },
    { href: '/templates',  label: 'Templates',  icon: GridViewIcon,    disabled: false },
    { href: '/metrics',    label: 'Metrics',    icon: Analytics02Icon, disabled: false },
    { href: '/settings',   label: 'Settings',   icon: Settings01Icon,  disabled: false },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-2 space-y-1">
        {wsLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent">
                <span
                  className={`flex-1 truncate text-left ${activeWorkspace ? '' : 'font-normal text-muted-foreground'}`}
                >
                  {activeWorkspace?.name ?? 'No active workspaces'}
                </span>
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {workspaces.length === 0 ? (
                <DropdownMenuItem disabled>No active workspaces</DropdownMenuItem>
              ) : (
                workspaces.map((ws) => (
                  <DropdownMenuItem key={ws.id} onClick={() => setActiveWorkspace(ws)}>
                    {ws.name}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setWsDialogOpen(true)}>
                <HugeiconsIcon icon={Add01Icon} className="mr-2 size-3.5" />
                Create workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Dialog open={wsDialogOpen} onOpenChange={setWsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5 py-2">
              <Label htmlFor="sidebar-ws-name">Workspace name</Label>
              <Input
                id="sidebar-ws-name"
                placeholder="My company"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateWorkspace(); }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWsDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => void handleCreateWorkspace()}
                disabled={!wsName.trim() || creatingWs}
              >
                {creatingWs ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {navItems.map(({ href, label, icon, disabled }) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton
                asChild={!disabled}
                isActive={!disabled && pathname.startsWith(href)}
                className={disabled ? 'opacity-40 cursor-not-allowed' : ''}
              >
                {disabled ? (
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={icon} className="size-4" />
                    <span>{label}</span>
                  </span>
                ) : (
                  <Link href={href} className="flex items-center gap-2">
                    <HugeiconsIcon icon={icon} className="size-4" />
                    <span>{label}</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <GettingStarted />
      <SidebarFooter className="border-t px-3 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="text-xs">{user?.firstName?.[0] ?? '?'}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account'}
          </span>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Logout03Icon} className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NotificationBell() {
  const { getToken } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const data = await api.get<{ read: boolean }[]>('/notifications');
        setUnread(data.filter((n) => !n.read).length);
      } catch {
        // silently fail
      }
    }
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [getToken]);

  return (
    <Link href="/notifications" className="relative p-1.5 rounded-md hover:bg-muted transition-colors">
      <HugeiconsIcon icon={Notification01Icon} className="size-5 text-muted-foreground" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-medium">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const { activePod } = usePod();
  const router = useRouter();

  useEffect(() => {
    const handler = () => setCmdkOpen(true);
    window.addEventListener('linea:open-cmdk', handler);
    return () => window.removeEventListener('linea:open-cmdk', handler);
  }, []);

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const podBase = activePod ? `/pods/${activePod.id}` : null;

    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Cmd+K / Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
        return;
      }

      if (inInput) return;

      // ? → shortcuts dialog
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        window.dispatchEvent(new CustomEvent('linea:open-shortcuts'));
        return;
      }

      // g → start sequence
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);

        const map: Record<string, string | null> = {
          w: podBase ? `${podBase}/workflows` : null,
          e: podBase ? `${podBase}/executions` : null,
          s: podBase ? `${podBase}/schedules` : null,
          k: '/knowledge',
          t: '/templates',
          m: '/metrics',
        };

        const dest = map[e.key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [activePod, router]);

  return (
    <>
      {children}
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />
      <KeyboardShortcutsDialog />
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <PodProvider>
        <SidebarProvider>
          <ShortcutsProvider>
            <DashboardSidebar />
            <main className="flex flex-1 flex-col">
              <header className="flex h-12 items-center gap-3 border-b px-4">
                <SidebarTrigger />
                <div className="h-4 w-px bg-border" />
                <PodSwitcher />
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('linea:open-cmdk'))}
                  className="flex flex-1 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors max-w-xs mx-2"
                >
                  <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0" />
                  <span className="flex-1 text-left">Search or jump to…</span>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
                </button>
                <div className="flex-1" />
                <NotificationBell />
              </header>
              <div className="flex-1 p-6">{children}</div>
            </main>
            <WelcomeModal />
          </ShortcutsProvider>
        </SidebarProvider>
      </PodProvider>
    </WorkspaceProvider>
  );
}
