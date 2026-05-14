'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePod } from '@/contexts/space-context';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@linea/ui/components/command';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  FlowCircleIcon,
  Calendar01Icon,
  LinkSquare01Icon,
  Database01Icon,
  GridViewIcon,
  Analytics02Icon,
  Settings01Icon,
  LayoutLeftIcon,
  Add01Icon,
  QuestionIcon,
} from '@hugeicons/core-free-icons';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { activePod, pods } = usePod();
  const [search, setSearch] = useState('');

  const podBase = activePod ? `/pods/${activePod.id}` : null;

  function run(fn: () => void) {
    fn();
    onOpenChange(false);
    setSearch('');
  }

  const navItems = [
    {
      label: 'Workflows',
      icon: WorkflowSquare01Icon,
      href: podBase ? `${podBase}/workflows` : null,
      shortcut: 'G W',
    },
    {
      label: 'Executions',
      icon: FlowCircleIcon,
      href: podBase ? `${podBase}/executions` : null,
      shortcut: 'G E',
    },
    {
      label: 'Schedules',
      icon: Calendar01Icon,
      href: podBase ? `${podBase}/schedules` : null,
      shortcut: 'G S',
    },
    {
      label: 'Webhooks',
      icon: LinkSquare01Icon,
      href: podBase ? `${podBase}/webhooks` : null,
    },
    {
      label: 'Knowledge',
      icon: Database01Icon,
      href: '/knowledge',
      shortcut: 'G K',
    },
    {
      label: 'Templates',
      icon: GridViewIcon,
      href: '/templates',
      shortcut: 'G T',
    },
    {
      label: 'Metrics',
      icon: Analytics02Icon,
      href: '/metrics',
      shortcut: 'G M',
    },
    {
      label: 'Settings',
      icon: Settings01Icon,
      href: '/settings',
    },
    {
      label: 'Pods',
      icon: LayoutLeftIcon,
      href: '/pods',
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput
        placeholder="Search pages and actions…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {navItems.map(({ label, icon, href, shortcut }) => (
            <CommandItem
              key={label}
              value={label}
              disabled={!href}
              onSelect={() => href && run(() => router.push(href))}
            >
              <HugeiconsIcon icon={icon} className="size-3.5" />
              {label}
              {!href && (
                <span className="ml-1 text-[10px] text-muted-foreground">(no active pod)</span>
              )}
              {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {podBase && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              <CommandItem
                value="New workflow"
                onSelect={() => run(() => router.push(`${podBase}/workflows`))}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                New workflow
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {pods.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch pod">
              {pods.map((pod) => (
                <CommandItem
                  key={pod.id}
                  value={`pod ${pod.name}`}
                  onSelect={() => run(() => router.push(`/pods/${pod.id}/workflows`))}
                >
                  <HugeiconsIcon icon={LayoutLeftIcon} className="size-3.5" />
                  {pod.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem
            value="Keyboard shortcuts"
            onSelect={() => {
              onOpenChange(false);
              window.dispatchEvent(new CustomEvent('linea:open-shortcuts'));
            }}
          >
            <HugeiconsIcon icon={QuestionIcon} className="size-3.5" />
            Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
