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
  ArrowLeft01Icon,
  Logout03Icon,
  Database01Icon,
  Archive01Icon,
  Calendar01Icon,
  LinkSquare01Icon,
  Add01Icon,
  Analytics02Icon,
  GridViewIcon,
  Search01Icon,
  AiMagicIcon,
  BookOpen01Icon,
  CustomerSupportIcon,
  Bug01Icon,
  CompassIcon,
  HelpCircleIcon,
  UserMultiple02Icon,
  Key01Icon,
  SquareLock01Icon,
  AiBrain01Icon,
  GlobalIcon,
  ComputerCloudIcon,
  Invoice03Icon,
  Home01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Alert01Icon,
  Clock01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@linea/ui/components/sheet';
import { ScrollArea } from '@linea/ui/components/scroll-area';

function PodSwitcher() {
  const { pods, activePod, setActivePod, loading } = usePod();

  if (loading) return <div className="h-7 w-32 animate-pulse rounded bg-muted" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button data-tour="pod-switcher" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors max-w-48">
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

async function startTour() {
  const { driver } = await import('driver.js');
  const driverObj = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.4,
    steps: [
      {
        popover: {
          title: 'Welcome to Linea',
          description: "Let's take a quick tour of the platform essentials. Press Next to continue or Esc to exit anytime.",
          align: 'center',
        },
      },
      {
        element: '[data-tour="workspace-switcher"]',
        popover: {
          title: 'Workspaces',
          description: 'Workspaces keep your team\'s work organized. Switch between them or create a new one here.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="pod-switcher"]',
        popover: {
          title: 'Pods',
          description: 'Pods group related workflows, schedules, and webhooks. Select your active pod from this menu.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="nav-workflows"]',
        popover: {
          title: 'Workflows',
          description: 'Build automation workflows using a visual canvas. Connect nodes for HTTP requests, AI, code, integrations, and more.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-ai-tasks"]',
        popover: {
          title: 'Linea Agent',
          description: 'Chat with an AI agent that has access to all your integrations and can run tasks on your behalf in real time.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-knowledge"]',
        popover: {
          title: 'Knowledge',
          description: 'Upload documents and data that your AI agents can search and retrieve during workflow execution.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-templates"]',
        popover: {
          title: 'Templates',
          description: 'Browse ready-made workflow templates shared by your team or the community to get started quickly.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="search-bar"]',
        popover: {
          title: 'Command Palette',
          description: 'Press ⌘K (or Ctrl+K) to quickly search workflows, jump to any page, or run commands.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="help-menu"]',
        popover: {
          title: 'Help & Support',
          description: 'Access the docs, contact support, report bugs, or start this tour again — all from here.',
          side: 'right',
          align: 'start',
        },
      },
    ],
  });
  driverObj.drive();
}

const BILLING_ENABLED = process.env['NEXT_PUBLIC_BILLING_ENABLED'] === 'true';

const settingsNavItems = [
  { href: '/settings/general',     label: 'General',      icon: Settings01Icon     },
  { href: '/settings/members',     label: 'Members',      icon: UserMultiple02Icon },
  { href: '/settings/api-keys',    label: 'API Keys',     icon: Key01Icon          },
  { href: '/settings/credentials', label: 'Secrets',      icon: SquareLock01Icon   },
  { href: '/settings/model-keys',  label: 'Model Keys',   icon: AiBrain01Icon      },
  { href: '/settings/connections', label: 'Connections',  icon: GlobalIcon         },
  { href: '/settings/mcp-servers', label: 'MCP Servers',  icon: ComputerCloudIcon  },
  ...(BILLING_ENABLED ? [{ href: '/settings/billing', label: 'Billing', icon: Invoice03Icon }] : []),
];

function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspace, addWorkspace, loading: wsLoading } = useWorkspace();
  const { activePod } = usePod();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  const isSettings = pathname.startsWith('/settings');

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
    { href: '/home',                                       label: 'Home',        icon: Home01Icon,           disabled: false,    dataTour: undefined },
    { href: podBase ? `${podBase}/workflows`  : '/pods', label: 'Workflows',  icon: WorkflowSquare01Icon, disabled: !podBase, dataTour: 'nav-workflows' },
    { href: podBase ? `${podBase}/executions` : '/pods', label: 'Executions', icon: FlowCircleIcon,        disabled: !podBase, dataTour: undefined },
    { href: podBase ? `${podBase}/schedules`  : '/pods', label: 'Schedules',  icon: Calendar01Icon,        disabled: !podBase, dataTour: undefined },
    { href: podBase ? `${podBase}/webhooks`   : '/pods', label: 'Webhooks',   icon: LinkSquare01Icon,      disabled: !podBase, dataTour: undefined },
    { href: '/tasks',      label: 'Linea Agent', icon: AiMagicIcon,    disabled: false, dataTour: 'nav-ai-tasks' },
    { href: '/knowledge',  label: 'Knowledge',  icon: Database01Icon,  disabled: false, dataTour: 'nav-knowledge' },
    { href: '/templates',  label: 'Templates',  icon: GridViewIcon,    disabled: false, dataTour: 'nav-templates' },
    { href: '/metrics',    label: 'Metrics',    icon: Analytics02Icon, disabled: false, dataTour: undefined },
    { href: '/usage',      label: 'Usage',      icon: Invoice03Icon,   disabled: false, dataTour: undefined },
    { href: '/audit',      label: 'Audit',      icon: BookOpen01Icon,  disabled: false, dataTour: undefined },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-2 space-y-1">
        {wsLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-tour="workspace-switcher" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent">
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
        {isSettings ? (
          <>
            <div className="mb-1 px-1">
              <button
                onClick={() => router.back()}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5 shrink-0" />
                <span>Back</span>
              </button>
              <p className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Settings
              </p>
            </div>
            <SidebarMenu>
              {settingsNavItems.map(({ href, label, icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname === href || pathname.startsWith(href + '/')}>
                    <Link href={href} className="flex items-center gap-2">
                      <HugeiconsIcon icon={icon} className="size-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </>
        ) : (
          <SidebarMenu>
            {navItems.map(({ href, label, icon, disabled, dataTour }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  asChild={!disabled}
                  isActive={!disabled && pathname.startsWith(href)}
                  className={disabled ? 'opacity-40 cursor-not-allowed' : ''}
                >
                  {disabled ? (
                    <span className="flex items-center gap-2" data-tour={dataTour}>
                      <HugeiconsIcon icon={icon} className="size-4" />
                      <span>{label}</span>
                    </span>
                  ) : (
                    <Link href={href} className="flex items-center gap-2" data-tour={dataTour}>
                      <HugeiconsIcon icon={icon} className="size-4" />
                      <span>{label}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
      </SidebarContent>

      <GettingStarted />
      <SidebarFooter className="px-3 py-3 space-y-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-tour="help-menu"
              title="Help"
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={HelpCircleIcon} className="size-3.5" />
              <span>Help</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-44">
            <DropdownMenuItem asChild>
              <a
                href="https://docs.linea.build"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={BookOpen01Icon} className="size-3.5" />
                Docs
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="mailto:support@linea.build" className="flex items-center gap-2">
                <HugeiconsIcon icon={CustomerSupportIcon} className="size-3.5" />
                Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href="https://github.com/linea-build/linea/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={Bug01Icon} className="size-3.5" />
                Report a bug
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void startTour()}
              className="flex items-center gap-2"
            >
              <HugeiconsIcon icon={CompassIcon} className="size-3.5" />
              Take a tour
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Avatar className="size-7 shrink-0">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="text-xs">{user?.firstName?.[0] ?? '?'}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account'}
          </span>
          <Link
            href="/settings/general"
            title="Settings"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Settings01Icon} className="size-4" />
          </Link>
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

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  resourceUrl?: string | null;
}

type NotifFilter = 'all' | 'execution' | 'approval' | 'schedule' | 'system';

const NOTIF_FILTERS: { key: NotifFilter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'execution', label: 'Executions' },
  { key: 'approval',  label: 'Approvals'  },
  { key: 'schedule',  label: 'Scheduled'  },
  { key: 'system',    label: 'System'     },
];

function matchesFilter(n: Notification, filter: NotifFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'execution') return n.type.includes('execution') || n.type.includes('fail') || n.type.includes('complet') || n.type.includes('success');
  if (filter === 'approval')  return n.type.includes('approval') || n.type.includes('suspend');
  if (filter === 'schedule')  return n.type.includes('schedul') || n.type.includes('trigger');
  if (filter === 'system')    return !['execution','fail','complet','success','approval','suspend','schedul','trigger'].some((k) => n.type.includes(k));
  return true;
}

function notifIcon(type: string) {
  if (type.includes('fail') || type.includes('error')) return { icon: Cancel01Icon, color: 'text-destructive' };
  if (type.includes('complet') || type.includes('success')) return { icon: CheckmarkCircle01Icon, color: 'text-green-500' };
  if (type.includes('approval') || type.includes('suspend')) return { icon: Alert01Icon, color: 'text-amber-500' };
  if (type.includes('schedul') || type.includes('trigger')) return { icon: Clock01Icon, color: 'text-blue-500' };
  return { icon: Archive01Icon, color: 'text-muted-foreground' };
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function NotificationBell() {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [typeFilter, setTypeFilter] = useState<NotifFilter>('all');

  const unread = notifications.filter((n) => !n.read).length;

  async function loadNotifs() {
    setLoadingNotifs(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const data = await api.get<Notification[]>('/notifications');
      setNotifications(data ?? []);
    } catch {
      // silently fail
    } finally {
      setLoadingNotifs(false);
    }
  }

  // Poll unread count every 30s
  useEffect(() => {
    void loadNotifs();
    const interval = setInterval(() => void loadNotifs(), 30_000);
    return () => clearInterval(interval);
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when sheet opens
  useEffect(() => {
    if (open) void loadNotifs();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markRead(id: string) {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }

  async function dismiss(id: string) {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
  }

  const filtered = notifications.filter((n) => matchesFilter(n, typeFilter));
  const unreadItems = filtered.filter((n) => !n.read);
  const readItems = filtered.filter((n) => n.read);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        title="Notifications"
      >
        <HugeiconsIcon icon={Archive01Icon} className="size-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="data-[side=right]:w-[420px] data-[side=right]:sm:max-w-[420px] flex flex-col p-0" showCloseButton={false}>
          <SheetHeader className="flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm">Notifications</SheetTitle>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white leading-none">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </SheetHeader>

          {/* Type filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 border-b border-border/50 shrink-0">
            {NOTIF_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${typeFilter === f.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {loadingNotifs && notifications.length === 0 ? (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon icon={Archive01Icon} className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{notifications.length === 0 ? 'All caught up' : 'No matches'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{notifications.length === 0 ? 'No notifications right now.' : 'Try a different filter.'}</p>
              </div>
            ) : (
              <div>
                {unreadItems.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Unread
                    </p>
                    {unreadItems.map((n) => {
                      const { icon, color } = notifIcon(n.type);
                      const rowContent = (
                        <>
                          <div className={`mt-0.5 shrink-0 ${color}`}>
                            <HugeiconsIcon icon={icon} className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium leading-snug">{n.title}</p>
                              <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{timeAgoShort(n.createdAt)}</span>
                            </div>
                            {n.body && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.body}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              {n.resourceUrl && (
                                <>
                                  <span className="text-[10px] text-primary">View</span>
                                  <span className="text-muted-foreground/30">·</span>
                                </>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); void markRead(n.id); }}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Mark read
                              </button>
                              <span className="text-muted-foreground/30">·</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); void dismiss(n.id); }}
                                className="text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </>
                      );
                      return n.resourceUrl ? (
                        <Link
                          key={n.id}
                          href={n.resourceUrl}
                          onClick={() => { void markRead(n.id); setOpen(false); }}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/50 bg-muted/20"
                        >
                          {rowContent}
                        </Link>
                      ) : (
                        <div
                          key={n.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/50 bg-muted/20"
                        >
                          {rowContent}
                        </div>
                      );
                    })}
                  </div>
                )}

                {readItems.length > 0 && (
                  <div>
                    {unreadItems.length > 0 && (
                      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Read
                      </p>
                    )}
                    {readItems.map((n) => {
                      const { icon, color } = notifIcon(n.type);
                      const rowContent = (
                        <>
                          <div className={`mt-0.5 shrink-0 ${color}`}>
                            <HugeiconsIcon icon={icon} className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs leading-snug">{n.title}</p>
                              <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{timeAgoShort(n.createdAt)}</span>
                            </div>
                            {n.body && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.body}</p>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); void dismiss(n.id); }}
                              className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              Dismiss
                            </button>
                          </div>
                        </>
                      );
                      return n.resourceUrl ? (
                        <Link
                          key={n.id}
                          href={n.resourceUrl}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/50 opacity-60"
                        >
                          {rowContent}
                        </Link>
                      ) : (
                        <div
                          key={n.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/50 opacity-60"
                        >
                          {rowContent}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="border-t px-4 py-3 shrink-0">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors w-full"
            >
              View all notifications
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
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
          h: '/home',
          w: podBase ? `${podBase}/workflows` : null,
          e: podBase ? `${podBase}/executions` : null,
          s: podBase ? `${podBase}/schedules` : null,
          a: '/tasks',
          k: '/knowledge',
          t: '/templates',
          m: '/metrics',
          u: '/usage',
          l: '/audit',
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
                <PodSwitcher />
                <button
                  data-tour="search-bar"
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
