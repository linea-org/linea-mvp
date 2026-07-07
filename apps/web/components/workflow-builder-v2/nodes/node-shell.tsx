"use client"

import React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ZapIcon,
  Square01Icon,
  Robot01Icon,
  Globe02Icon,
  CodeIcon,
  LockKeyIcon,
  SquareLock01Icon,
  LayoutTopIcon,
  LayoutLeftIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@linea/ui/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@linea/ui/components/tooltip"

export interface Theme {
  icon: IconSvgElement
  color: string
}
export const defaultTheme: Theme = { icon: Robot01Icon, color: "#3b82f6" }
export const themes: Record<string, Theme> = {
  start: { icon: ZapIcon, color: "#6366f1" },
  end: { icon: Square01Icon, color: "#14b8a6" },
  agent: { icon: Robot01Icon, color: "#3b82f6" },
  http: { icon: Globe02Icon, color: "#8b5cf6" },
  transform: { icon: CodeIcon, color: "#7c3aed" },
}

export function fmt(v: unknown, max = 26): string {
  const s = String(v ?? "")
  return s.length > max ? s.slice(0, max) + "…" : s
}

function StatusDot({ status }: { status?: string }) {
  if (!status) return null
  const cls =
    status === "running"
      ? "size-2 rounded-full bg-orange-400 animate-pulse"
      : status === "completed"
        ? "size-2 rounded-full bg-green-500"
        : status === "failed"
          ? "size-2 rounded-full bg-red-500"
          : "size-2 rounded-full bg-muted-foreground"
  return <span className={cls} />
}

export const TARGET_CLS =
  "!size-3 !rounded-full !border-[2px] !border-muted-foreground/60 !bg-background " +
  "hover:!border-foreground hover:!scale-125 transition-transform duration-150"
export const SOURCE_CLS =
  "!size-3 !rounded-full !border-[2px] !border-background !bg-muted-foreground/70 " +
  "hover:!bg-foreground hover:!scale-125 transition-transform duration-150"

const STATUS_RING: Record<
  string,
  { border: string; shadow: string; animate?: string }
> = {
  running: {
    border: "rgb(59,130,246)",
    shadow: "0 0 0 3px rgba(59,130,246,0.45)",
    animate: "animate-pulse",
  },
  completed: {
    border: "rgb(34,197,94)",
    shadow: "0 0 0 2px rgba(34,197,94,0.55)",
  },
  failed: {
    border: "rgb(239,68,68)",
    shadow: "0 0 0 2px rgba(239,68,68,0.55)",
  },
  suspended: {
    border: "rgb(245,158,11)",
    shadow: "0 0 0 2px rgba(245,158,11,0.55)",
  },
}

export function NodeShell({
  nodeType,
  label,
  status,
  selected,
  properties,
  posLocked,
  delLocked,
  portsVertical,
  onTogglePorts,
  outputPreview,
  children,
}: {
  nodeType: string
  label: string
  status?: string
  selected: boolean
  properties: Array<{ key: string; value: string }>
  posLocked: boolean
  delLocked: boolean
  portsVertical: boolean
  onTogglePorts: () => void
  outputPreview?: string
  children?: React.ReactNode
}) {
  const theme = themes[nodeType] ?? defaultTheme
  const ring = status ? STATUS_RING[status] : undefined

  const borderColor = ring?.border ?? (selected ? theme.color : undefined)
  const boxShadow = ring
    ? ring.shadow
    : selected
      ? `0 0 0 2px ${theme.color}33, 0 2px 8px rgba(0,0,0,.10)`
      : undefined

  return (
    <div
      className={cn(
        "min-w-[176px] cursor-grab rounded-xl border bg-background shadow-sm transition-shadow duration-300 select-none",
        selected && !ring ? "shadow-md" : "",
        ring?.animate ?? ""
      )}
      style={{ borderColor: borderColor ?? "hsl(var(--border))", boxShadow }}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.color }}
        >
          <HugeiconsIcon
            icon={theme.icon}
            className="size-3.5 text-white"
            strokeWidth={1.5}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-tight font-semibold text-foreground">
            {label}
          </p>
          {status ? (
            <div className="mt-0.5 flex items-center gap-1">
              <StatusDot status={status} />
              <span className="text-[10px] text-muted-foreground capitalize">
                {status}
              </span>
            </div>
          ) : posLocked || delLocked ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              {posLocked && (
                <span title="Position locked">
                  <HugeiconsIcon
                    icon={LockKeyIcon}
                    className="size-2.5 text-amber-500"
                  />
                </span>
              )}
              {delLocked && (
                <span title="Deletion locked">
                  <HugeiconsIcon
                    icon={SquareLock01Icon}
                    className="size-2.5 text-red-400"
                  />
                </span>
              )}
            </div>
          ) : null}
        </div>
        <button
          title={
            portsVertical
              ? "Switch to horizontal ports"
              : "Switch to vertical ports"
          }
          onClick={(e) => {
            e.stopPropagation()
            onTogglePorts()
          }}
          className={cn(
            "nodrag shrink-0 rounded p-0.5 transition-colors",
            portsVertical
              ? "bg-muted text-foreground"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
        >
          <HugeiconsIcon
            icon={portsVertical ? LayoutTopIcon : LayoutLeftIcon}
            className="size-3"
          />
        </button>
      </div>

      {properties.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {properties.map(({ key, value }) => (
            <span
              key={key}
              title={`${key}: ${value}`}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5"
            >
              <span className="shrink-0 text-[8px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                {key}
              </span>
              <span className="truncate font-mono text-[9px] text-foreground/75">
                {value}
              </span>
            </span>
          ))}
        </div>
      )}

      {outputPreview && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mx-2.5 cursor-default border-t border-border/40 pt-1 pb-1.5">
              <p className="truncate font-mono text-[9px] text-foreground/50">
                {outputPreview}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-xs font-mono text-[10px] break-all"
          >
            {outputPreview}
          </TooltipContent>
        </Tooltip>
      )}

      {children}
    </div>
  )
}
