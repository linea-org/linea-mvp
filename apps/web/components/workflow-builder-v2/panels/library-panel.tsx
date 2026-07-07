"use client"

import { useState, useMemo } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Robot01Icon,
  Globe02Icon,
  CodeIcon,

  ArrowDown01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@linea/ui/components/input"
import { cn } from "@linea/ui/lib/utils"

interface NodeDef {
  type: string
  label: string
  description: string
  icon: IconSvgElement
  color: string
}

const categories: { label: string; nodes: NodeDef[] }[] = [
  {
    label: "AI",
    nodes: [
      {
        type: "agent",
        label: "Agent",
        description: "LLM-powered reasoning node",
        icon: Robot01Icon,
        color: "#3b82f6",
      },
    ],
  },
  {
    label: "Tools",
    nodes: [
      {
        type: "http",
        label: "HTTP",
        description: "Call any external API",
        icon: Globe02Icon,
        color: "#8b5cf6",
      },
    ],
  },
  {
    label: "Data",
    nodes: [
      {
        type: "transform",
        label: "Transform",
        description: "Reshape variables with JS",
        icon: CodeIcon,
        color: "#7c3aed",
      },
    ],
  },

]

function NodeRow({ node }: { node: NodeDef }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("nodeType", node.type)
        e.dataTransfer.effectAllowed = "copy"
      }}
      title={node.description}
      className="flex cursor-grab items-center gap-2.5 rounded-md px-2 py-[5px] transition-colors select-none hover:bg-muted/60 active:cursor-grabbing"
    >
      <div
        className="flex size-[22px] shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: node.color }}
      >
        <HugeiconsIcon
          icon={node.icon}
          className="size-3 text-white"
          strokeWidth={1.5}
        />
      </div>
      <span className="truncate text-xs text-foreground/90">{node.label}</span>
    </div>
  )
}

function Category({
  label,
  nodes,
  defaultOpen = true,
}: {
  label: string
  nodes: NodeDef[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-1 text-left"
      >
        <span className="text-[9px] font-bold tracking-widest text-muted-foreground/60 uppercase">
          {label}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn(
            "size-3 text-muted-foreground/40 transition-transform duration-150",
            !open && "-rotate-90"
          )}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="mb-1">
          {nodes.map((n) => (
            <NodeRow key={n.type} node={n} />
          ))}
        </div>
      )}
    </div>
  )
}

export function LibraryPanel() {
  const [query, setQuery] = useState("")

  const allNodes = useMemo(() => categories.flatMap((c) => c.nodes), [])

  const filtered = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    return allNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
    )
  }, [query, allNodes])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-2.5 py-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="px-1">
              {filtered.map((n) => (
                <NodeRow key={n.type} node={n} />
              ))}
            </div>
          )
        ) : (
          categories.map((cat) => (
            <Category
              key={cat.label}
              label={cat.label}
              nodes={cat.nodes}
              defaultOpen={true}
            />
          ))
        )}
      </div>
    </div>
  )
}
