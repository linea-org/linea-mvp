'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useClerk, useUser, useAuth } from '@clerk/nextjs';
import { WorkspaceProvider, useWorkspace } from '@/contexts/workspace-context';
import { SpaceProvider, useSpace } from '@/contexts/space-context';
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
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  FlowCircleIcon,
  Settings01Icon,
  ArrowDown01Icon,
  Logout03Icon,
  LayoutLeftIcon,
  Database01Icon,
  Notification01Icon,
} from '@hugeicons/core-free-icons';

function DashboardSidebar() {
  const pathname = usePathname();
  const { workspaces, activeWorkspace, setActiveWorkspace, loading: wsLoading } = useWorkspace();
  const { spaces, activeSpace, setActiveSpace, loading: spaceLoading } = useSpace();
  const { user } = useUser();
  const { signOut } = useClerk();

  const spaceBase = activeSpace ? `/spaces/${activeSpace.id}` : null;

  const navItems = [
    { href: spaceBase ? `${spaceBase}/workflows` : '/spaces', label: 'Workflows', icon: WorkflowSquare01Icon, disabled: !spaceBase },
    { href: spaceBase ? `${spaceBase}/executions` : '/spaces', label: 'Executions', icon: FlowCircleIcon, disabled: !spaceBase },
    { href: '/knowledge', label: 'Knowledge', icon: Database01Icon, disabled: false },
    { href: '/settings', label: 'Settings', icon: Settings01Icon, disabled: false },
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
                <span className="flex-1 truncate text-left">
                  {activeWorkspace?.name ?? 'No workspace'}
                </span>
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {workspaces.map((ws) => (
                <DropdownMenuItem key={ws.id} onClick={() => setActiveWorkspace(ws)}>
                  {ws.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {spaceLoading ? (
          <Skeleton className="h-7 w-full" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent text-muted-foreground">
                <HugeiconsIcon icon={LayoutLeftIcon} className="size-3.5 shrink-0" />
                <span className="flex-1 truncate text-left">
                  {activeSpace?.name ?? 'No space'}
                </span>
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {spaces.length === 0 ? (
                <DropdownMenuItem disabled>
                  <Link href="/spaces" className="w-full text-xs">Create a space</Link>
                </DropdownMenuItem>
              ) : (
                spaces.map((sp) => (
                  <DropdownMenuItem key={sp.id} onClick={() => setActiveSpace(sp)}>
                    {sp.name}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/spaces" className="text-xs">Manage spaces</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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

      <SidebarFooter className="border-t px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
              <Avatar className="size-6">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback>{user?.firstName?.[0] ?? '?'}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-left">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <HugeiconsIcon icon={Logout03Icon} className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <SpaceProvider>
        <SidebarProvider>
          <DashboardSidebar />
          <main className="flex flex-1 flex-col">
            <header className="flex h-12 items-center justify-between border-b px-4">
              <SidebarTrigger />
              <NotificationBell />
            </header>
            <div className="flex-1 p-6">{children}</div>
          </main>
        </SidebarProvider>
      </SpaceProvider>
    </WorkspaceProvider>
  );
}
