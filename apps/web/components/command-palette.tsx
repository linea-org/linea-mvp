"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { usePod } from "@/contexts/space-context"
import { useWorkspace } from "@/contexts/workspace-context"
import { useApiClient } from "@/hooks/use-api-client"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@linea/ui/components/command"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  WorkflowSquare01Icon,
  FlowCircleIcon,
  Calendar01Icon,
  LinkSquare01Icon,
  Database01Icon,
  GridViewIcon,
  Analytics02Icon,
  Settings01Icon,
  Add01Icon,
  QuestionIcon,
  Notification01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RecentWorkflow {
  id: string
  name: string
  podId: string
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const getApi = useApiClient()
  const { activePod, pods, setActivePod } = usePod()
  const { activeWorkspace } = useWorkspace()
  const [search, setSearch] = useState("")

  const podBase = activePod ? `/pods/${activePod.id}` : null

  const { data: recentWorkflows = [] } = useQuery<RecentWorkflow[]>({
    queryKey: ["recent-workflows", activeWorkspace?.id, activePod?.id],
    enabled: open && !!activePod && !!activeWorkspace,
    queryFn: async () => {
      const api = await getApi()
      const data = await api.get<{ workflows: RecentWorkflow[] }>(
        `/workspaces/${activeWorkspace!.id}/pods/${activePod!.id}/workflows?limit=5`
      )
      return data.workflows ?? []
    },
  })

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  function run(fn: () => void) {
    fn()
    onOpenChange(false)
  }

  const navItems = [
    {
      label: "Workflows",
      icon: WorkflowSquare01Icon,
      href: podBase ? `${podBase}/workflows` : null,
      shortcut: "G W",
    },
    {
      label: "Executions",
      icon: FlowCircleIcon,
      href: podBase ? `${podBase}/executions` : null,
      shortcut: "G E",
    },
    {
      label: "Schedules",
      icon: Calendar01Icon,
      href: podBase ? `${podBase}/schedules` : null,
      shortcut: "G S",
    },
    {
      label: "Webhooks",
      icon: LinkSquare01Icon,
      href: podBase ? `${podBase}/webhooks` : null,
    },
    {
      label: "Knowledge",
      icon: Database01Icon,
      href: "/knowledge",
      shortcut: "G K",
    },
    {
      label: "Templates",
      icon: GridViewIcon,
      href: "/templates",
      shortcut: "G T",
    },
    {
      label: "Metrics",
      icon: Analytics02Icon,
      href: "/metrics",
      shortcut: "G M",
    },
    {
      label: "Notifications",
      icon: Notification01Icon,
      href: "/notifications",
    },
    { label: "Settings", icon: Settings01Icon, href: "/settings" },
  ]

  const filteredNav = search
    ? navItems.filter((i) =>
        i.label.toLowerCase().includes(search.toLowerCase())
      )
    : navItems

  const filteredWorkflows = search
    ? recentWorkflows.filter((w) =>
        w.name.toLowerCase().includes(search.toLowerCase())
      )
    : recentWorkflows

  const otherPods = pods.filter((p) => p.id !== activePod?.id)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
    >
      <CommandInput
        placeholder="Search pages, workflows, actions…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1 py-4">
            <HugeiconsIcon
              icon={Search01Icon}
              className="size-5 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              No results for "{search}"
            </p>
          </div>
        </CommandEmpty>

        {filteredNav.length > 0 && (
          <CommandGroup heading="Navigate">
            {filteredNav.map(({ label, icon, href, shortcut }) => (
              <CommandItem
                key={label}
                value={label}
                disabled={!href}
                onSelect={() => href && run(() => router.push(href))}
              >
                <HugeiconsIcon icon={icon} className="size-3.5" />
                {label}
                {!href && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    (no active pod)
                  </span>
                )}
                {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {podBase &&
          (!search || "new workflow create".includes(search.toLowerCase())) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Create">
                <CommandItem
                  value="New workflow"
                  onSelect={() =>
                    run(() => router.push(`${podBase}/workflows`))
                  }
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                  New workflow
                  <CommandShortcut>N W</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </>
          )}

        {filteredWorkflows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent workflows">
              {filteredWorkflows.map((wf) => (
                <CommandItem
                  key={wf.id}
                  value={`workflow ${wf.name}`}
                  onSelect={() =>
                    run(() =>
                      router.push(`/pods/${wf.podId}/workflows/${wf.id}`)
                    )
                  }
                >
                  <HugeiconsIcon
                    icon={WorkflowSquare01Icon}
                    className="size-3.5"
                  />
                  {wf.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {otherPods.length > 0 &&
          (!search ||
            otherPods.some((p) =>
              p.name.toLowerCase().includes(search.toLowerCase())
            )) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Switch pod">
                {otherPods
                  .filter(
                    (p) =>
                      !search ||
                      p.name.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((pod) => (
                    <CommandItem
                      key={pod.id}
                      value={`pod ${pod.name}`}
                      onSelect={() =>
                        run(() => {
                          setActivePod(pod)
                          router.push(`/pods/${pod.id}/workflows`)
                        })
                      }
                    >
                      <HugeiconsIcon icon={GridViewIcon} className="size-3.5" />
                      {pod.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          )}

        {(!search ||
          "keyboard shortcuts help".includes(search.toLowerCase())) && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Help">
              <CommandItem
                value="Keyboard shortcuts"
                onSelect={() => {
                  onOpenChange(false)
                  window.dispatchEvent(new CustomEvent("linea:open-shortcuts"))
                }}
              >
                <HugeiconsIcon icon={QuestionIcon} className="size-3.5" />
                Keyboard shortcuts
                <CommandShortcut>?</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
