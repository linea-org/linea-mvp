"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  SidebarLeftIcon,
  PlayIcon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@linea/ui/components/button"
import { Separator } from "@linea/ui/components/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@linea/ui/components/tooltip"

interface ToolbarProps {
  workflowName: string
  libraryOpen: boolean
  setLibraryOpen: (v: boolean) => void
  onSave?: () => void
  onRun?: () => void
}

export function Toolbar({
  workflowName,
  libraryOpen,
  setLibraryOpen,
  onSave,
  onRun,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 shadow-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant={libraryOpen ? "secondary" : "ghost"}
              onClick={() => setLibraryOpen(!libraryOpen)}
            >
              <HugeiconsIcon icon={SidebarLeftIcon} className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            Toggle library
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4" />
        
        <span className="px-2 text-sm font-medium text-foreground">
          {workflowName}
        </span>

        <Separator orientation="vertical" className="h-4" />

        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          className="h-7 text-xs"
        >
          <HugeiconsIcon icon={FloppyDiskIcon} className="mr-1 size-3" />
          Save
        </Button>
        <Button
          size="sm"
          onClick={onRun}
          className="h-7 text-xs"
        >
          <HugeiconsIcon icon={PlayIcon} className="mr-1 size-3" />
          Run
        </Button>
      </div>
    </TooltipProvider>
  )
}
