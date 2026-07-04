"use client"

import { useState, useMemo } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Robot01Icon,
  AiBrain01Icon,
  GitBranchIcon,
  Globe02Icon,
  Plug01Icon,
  CodeIcon,
  CheckmarkCircle01Icon,
  StickyNote01Icon,
  Download04Icon,
  Database01Icon,
  Shield01Icon,
  RepeatIcon,
  WorkflowSquare01Icon,
  Message01Icon,
  SourceCodeSquareIcon,
  FileEditIcon,
  MailSend01Icon,
  Square01Icon,
  LayoutTable01Icon,
  Clock01Icon,
  VariableIcon,
  ChartEvaluationIcon,
  BorderAll01Icon,
  FilterIcon,
  GitMergeIcon,
  Calendar01Icon,
  Search01Icon,
  ArrowDown01Icon,
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
      {
        type: "memory",
        label: "Memory",
        description: "Read/write long-term memory",
        icon: AiBrain01Icon,
        color: "#a855f7",
      },
    ],
  },
  {
    label: "Logic",
    nodes: [
      {
        type: "if-else",
        label: "If / Else",
        description: "Conditional branch",
        icon: GitBranchIcon,
        color: "#f59e0b",
      },
      {
        type: "router",
        label: "Router",
        description: "Route to multiple paths",
        icon: GitBranchIcon,
        color: "#ea580c",
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
      {
        type: "mcp",
        label: "MCP Tool",
        description: "Model Context Protocol server",
        icon: Plug01Icon,
        color: "#eab308",
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
      {
        type: "filter",
        label: "Filter",
        description: "Filter array by condition",
        icon: FilterIcon,
        color: "#06b6d4",
      },
      {
        type: "merge",
        label: "Merge",
        description: "Combine arrays / objects",
        icon: GitMergeIcon,
        color: "#8b5cf6",
      },
      {
        type: "datetime",
        label: "Date/Time",
        description: "Format, parse, add dates",
        icon: Calendar01Icon,
        color: "#0d9488",
      },
      {
        type: "extract",
        label: "Extract",
        description: "Scrape web content",
        icon: Download04Icon,
        color: "#0ea5e9",
      },
      {
        type: "retriever",
        label: "Retriever",
        description: "Query knowledge base",
        icon: Database01Icon,
        color: "#10b981",
      },
    ],
  },
  {
    label: "Flow",
    nodes: [
      {
        type: "loop",
        label: "Loop",
        description: "Iterate over an array",
        icon: RepeatIcon,
        color: "#0891b2",
      },
      {
        type: "parallel",
        label: "Parallel",
        description: "Run branches in parallel",
        icon: LayoutTable01Icon,
        color: "#6366f1",
      },
      {
        type: "wait",
        label: "Wait",
        description: "Pause execution",
        icon: Clock01Icon,
        color: "#64748b",
      },
      {
        type: "approval",
        label: "Approval Gate",
        description: "Human-in-the-loop gate",
        icon: CheckmarkCircle01Icon,
        color: "#f97316",
      },
      {
        type: "variables",
        label: "Variables",
        description: "Set workflow variables",
        icon: VariableIcon,
        color: "#059669",
      },
      {
        type: "evaluator",
        label: "Evaluator",
        description: "Score output with AI",
        icon: ChartEvaluationIcon,
        color: "#d97706",
      },
      {
        type: "subworkflow",
        label: "Sub-workflow",
        description: "Call another workflow",
        icon: WorkflowSquare01Icon,
        color: "#7c3aed",
      },
      {
        type: "end",
        label: "End",
        description: "Terminate the workflow",
        icon: Square01Icon,
        color: "#14b8a6",
      },
    ],
  },
  {
    label: "Safety",
    nodes: [
      {
        type: "guardrails",
        label: "Guardrails",
        description: "PII / content safety filter",
        icon: Shield01Icon,
        color: "#ef4444",
      },
    ],
  },
  {
    label: "Integrations",
    nodes: [
      {
        type: "slack",
        label: "Slack",
        description: "Send Slack messages",
        icon: Message01Icon,
        color: "#4a154b",
      },
      {
        type: "github",
        label: "GitHub",
        description: "Manage issues and PRs",
        icon: SourceCodeSquareIcon,
        color: "#1f2328",
      },
      {
        type: "notion",
        label: "Notion",
        description: "Read and write Notion",
        icon: FileEditIcon,
        color: "#37352f",
      },
      {
        type: "gmail",
        label: "Gmail",
        description: "Send and read emails",
        icon: MailSend01Icon,
        color: "#ea4335",
      },
    ],
  },
  {
    label: "Canvas",
    nodes: [
      {
        type: "frame",
        label: "Frame",
        description: "Group nodes visually",
        icon: BorderAll01Icon,
        color: "#6366f1",
      },
      {
        type: "note",
        label: "Note",
        description: "Sticky annotation",
        icon: StickyNote01Icon,
        color: "#ca8a04",
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

<<<<<<< HEAD
/* ─── Collapsible category ───────────────────────────────────────── */
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
=======
function Category({ label, nodes, defaultOpen = true }: { label: string; nodes: NodeDef[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

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

  // The scrollable list below is a plain div (not flex/grid) so its height propagates correctly.
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
              defaultOpen={cat.label !== "Canvas" && cat.label !== "Safety"}
            />
          ))
        )}
      </div>
    </div>
  )
}
