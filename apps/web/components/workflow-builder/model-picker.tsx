"use client"

import { useEffect, useRef, useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@linea/ui/components/popover"
import { cn } from "@linea/ui/lib/utils"

const API_BASE = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/v1`

interface ModelDef {
  id: string
  name: string
  provider: string
  description: string
  tier: string
  useCases: string[]
  badge?: string
  dimensions?: number
  capabilities: {
    vision: boolean
    functionCalling: boolean
    embedding?: boolean
  }
  costPer1mTokens: { input: number; output: number }
}

const BADGE_STYLES: Record<string, string> = {
  recommended:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "best-for-agents":
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "best-reasoning":
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "best-value":
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  fastest: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "most-capable":
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  xai: "xAI",
  groq: "Groq",
  google: "Google",
  ollama: "Ollama",
}

const PROVIDER_ORDER = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "groq",
  "ollama",
]

export interface ModelPickerProps {
  value: string
  onValueChange: (v: string) => void
  embeddingOnly?: boolean
  filterUseCases?: string[]
  className?: string
  placeholder?: string
}

export function ModelPicker({
  value,
  onValueChange,
  embeddingOnly = false,
  filterUseCases,
  className,
  placeholder = "Select a model…",
}: ModelPickerProps) {
  const [models, setModels] = useState<ModelDef[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API_BASE}/models`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const raw = (data as { data?: unknown }).data ?? data
        const list = Array.isArray(raw) ? (raw as ModelDef[]) : []
        setModels(list)
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus())
    } else {
      setSearch("")
      setProviderFilter(null)
    }
  }, [open])

  const baseFiltered = models.filter((m) => {
    if (embeddingOnly) return m.capabilities.embedding === true
    if (m.capabilities.embedding) return false
    if (filterUseCases && filterUseCases.length > 0)
      return m.useCases.some((uc) => filterUseCases.includes(uc))
    return true
  })

  const availableProviders = PROVIDER_ORDER.filter((p) =>
    baseFiltered.some((m) => m.provider === p)
  )

  const visible = baseFiltered.filter((m) => {
    if (providerFilter && m.provider !== providerFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      )
    }
    return true
  })

  const byProvider: Record<string, ModelDef[]> = {}
  for (const m of visible) (byProvider[m.provider] ??= []).push(m)
  const orderedProviders = PROVIDER_ORDER.filter((p) => byProvider[p]?.length)

  const selected = models.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
            "hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {loading ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selected ? (
              <>
                <span className="truncate text-xs">{selected.name}</span>
                {selected.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold tracking-wide uppercase",
                      BADGE_STYLES[selected.badge] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {selected.badge.replace(/-/g, " ")}
                  </span>
                )}
                {embeddingOnly && selected.dimensions && (
                  <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
                    {selected.dimensions}d
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {placeholder}
              </span>
            )}
          </span>
          <svg
            viewBox="0 0 16 16"
            className="size-3.5 shrink-0 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M4 6l4 4 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 shadow-lg"
        align="start"
        sideOffset={4}
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <svg
            viewBox="0 0 16 16"
            className="size-3.5 shrink-0 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" className="size-3" fill="currentColor">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Provider filter chips */}
        {availableProviders.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b border-border px-2.5 py-2">
            <button
              type="button"
              onClick={() => setProviderFilter(null)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                providerFilter === null
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All
            </button>
            {availableProviders.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  setProviderFilter(providerFilter === p ? null : p)
                }
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                  providerFilter === p
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {PROVIDER_LABELS[p] ?? p}
              </button>
            ))}
          </div>
        )}

        {/* Model list */}
        <div className="max-h-[280px] overflow-y-auto py-1">
          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Loading models…
            </div>
          ) : visible.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No models found.
            </div>
          ) : (
            orderedProviders.map((provider) => (
              <div key={provider}>
                <p className="px-2.5 pt-2 pb-0.5 text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                  {PROVIDER_LABELS[provider] ?? provider}
                </p>
                {byProvider[provider]!.map((m) => {
                  const isSelected = m.id === value
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onValueChange(m.id)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      {/* checkmark column */}
                      <div className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                        {isSelected && (
                          <svg
                            viewBox="0 0 10 10"
                            className="size-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              d="M1.5 5l2.5 2.5 4.5-4.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] leading-tight font-medium">
                            {m.name}
                          </span>
                          {m.badge && (
                            <span
                              className={cn(
                                "rounded px-1 py-0.5 text-[8px] font-semibold tracking-wide uppercase",
                                BADGE_STYLES[m.badge] ??
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {m.badge.replace(/-/g, " ")}
                            </span>
                          )}
                          {embeddingOnly && m.dimensions && (
                            <span className="rounded bg-muted px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
                              {m.dimensions}d
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
