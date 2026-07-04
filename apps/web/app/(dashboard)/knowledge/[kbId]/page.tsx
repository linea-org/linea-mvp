"use client"

<<<<<<< HEAD
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Badge } from "@linea/ui/components/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  NoteEditIcon,
  FileUploadIcon,
  GlobalIcon,
  Search01Icon,
  Delete01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Loading02Icon,
  ArrowLeft01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Tick01Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
}

type EntryStatus = "pending" | "embedding" | "indexed" | "failed"

interface Entry {
  id: string
  content: string
  metadata: Record<string, unknown>
  status: EntryStatus
  createdAt: string
}

type IngestTab = "text" | "file" | "website"
type FileStatus = "idle" | "reading" | "ready" | "uploading" | "done" | "error"
type WebsitePhase = "input" | "discovering" | "select" | "ingesting"

interface UrlNode {
  label: string
  fullPath: string
  urls: string[]
  children: UrlNode[]
}

function buildUrlTree(urls: string[]): UrlNode {
  const root: UrlNode = { label: "/", fullPath: "", urls: [], children: [] }
  for (const url of urls) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    const parts = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean)
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const fp = "/" + parts.slice(0, i + 1).join("/")
      let child = node.children.find((c) => c.label === part)
      if (!child) {
        child = { label: part, fullPath: fp, urls: [], children: [] }
        node.children.push(child)
      }
      node = child
    }
    if (!node.urls.includes(url)) node.urls.push(url)
  }
  return root
}

function collectUrls(node: UrlNode): string[] {
  return [...node.urls, ...node.children.flatMap(collectUrls)]
}

function nodeSelectionState(
  node: UrlNode,
  selected: Set<string>
): "all" | "some" | "none" {
  const all = collectUrls(node)
  if (all.length === 0) return "none"
  const cnt = all.filter((u) => selected.has(u)).length
  if (cnt === 0) return "none"
  if (cnt === all.length) return "all"
  return "some"
}

function UrlTreeNode({
  node,
  selected,
  collapsed,
  onToggleSelect,
  onToggleCollapse,
  depth,
}: {
  node: UrlNode
  selected: Set<string>
  collapsed: Set<string>
  onToggleSelect: (node: UrlNode) => void
  onToggleCollapse: (path: string) => void
  depth: number
}) {
  const state = nodeSelectionState(node, selected)
  const isCollapsed = collapsed.has(node.fullPath)
  const hasChildren = node.children.length > 0
  const totalUrls = collectUrls(node).length

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded px-1 py-1 transition-colors hover:bg-muted/40"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={() => hasChildren && onToggleCollapse(node.fullPath)}
          className={`flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors ${hasChildren ? "hover:text-foreground" : "pointer-events-none opacity-0"}`}
        >
          <HugeiconsIcon
            icon={isCollapsed ? ArrowRight01Icon : ArrowDown01Icon}
            className="size-3"
          />
        </button>

        {/* Checkbox */}
        <button
          onClick={() => onToggleSelect(node)}
          className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
            state === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : state === "some"
                ? "border-primary/60 bg-primary/30"
                : "border-border hover:border-muted-foreground"
          }`}
        >
          {state === "all" && (
            <HugeiconsIcon icon={Tick01Icon} className="size-2.5" />
          )}
          {state === "some" && (
            <span className="block size-1.5 rounded-full bg-primary" />
          )}
        </button>

        {/* Label */}
        <span
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
          title={node.fullPath || "/"}
        >
          {node.label}
        </span>

        {/* URL count badge */}
        {totalUrls > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground opacity-60">
            {totalUrls}
          </span>
        )}
      </div>

      {/* Children */}
      {!isCollapsed && hasChildren && (
        <div>
          {node.children.map((child) => (
            <UrlTreeNode
              key={child.fullPath}
              node={child}
              selected={selected}
              collapsed={collapsed}
              onToggleSelect={onToggleSelect}
              onToggleCollapse={onToggleCollapse}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  text: "Text",
  file: "File",
  website: "Website",
}

const SOURCE_COLORS: Record<string, string> = {
  text: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900 dark:text-blue-400",
  file: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900 dark:text-purple-400",
  website:
    "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900 dark:text-green-400",
}

export default function KnowledgeBaseDetailPage() {
  const { kbId } = useParams<{ kbId: string }>()
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const router = useRouter()

  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  // Ingestion state
  const [ingestTab, setIngestTab] = useState<IngestTab>("text")
  const [textContent, setTextContent] = useState("")
  const [adding, setAdding] = useState(false)

  // File ingestion
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileStatus, setFileStatus] = useState<FileStatus>("idle")
  const [fileName, setFileName] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [fileError, setFileError] = useState("")

  // Website ingestion
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [websitePhase, setWebsitePhase] = useState<WebsitePhase>("input")
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const [ingestedCount, setIngestedCount] = useState(0)
  const [ingestTotal, setIngestTotal] = useState(0)

  // Search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null)
  const [searching, setSearching] = useState(false)
=======
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { useApiClient } from '@/hooks/use-api-client';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Badge } from '@linea/ui/components/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { KbIngestPanel } from './kb-ingest-panel';
import { KbEntriesList } from './kb-entries-list';
import type { KnowledgeBase, Entry } from './kb-types';

type IngestTab = 'text' | 'file' | 'website';
type WebsitePhase = 'input' | 'discovering' | 'select' | 'ingesting';

export default function KnowledgeBaseDetailPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const wsId = activeWorkspace?.id ?? '';
  const kbKey = ['knowledge-base', wsId, kbId];

  // Lifted so the entries list's "Re-crawl" action can jump the ingest panel to the website tab
  const [ingestTab, setIngestTab] = useState<IngestTab>('text');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websitePhase, setWebsitePhase] = useState<WebsitePhase>('input');
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  function handleRecrawl(url: string) {
    setIngestTab("website")
    setWebsiteUrl(url)
    setWebsitePhase("input")
    setDiscoveredUrls([])
    setSelectedUrls(new Set())
  }

<<<<<<< HEAD
  // Poll status for any entries that are still pending/embedding
  useEffect(() => {
    const inflight = entries.filter(
      (e) => e.status === "pending" || e.status === "embedding"
    )
    if (inflight.length === 0 || !activeWorkspace) return

    const interval = setInterval(async () => {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      await Promise.allSettled(
        inflight.map(async (entry) => {
          try {
            const updated = await api.get<{ id: string; status: EntryStatus }>(
              `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries/${entry.id}/status`
            )
            if (updated.status !== entry.status) {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entry.id ? { ...e, status: updated.status } : e
                )
              )
            }
          } catch {
            // silently skip — entry may have been deleted
          }
        })
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [entries, activeWorkspace, kbId, getToken]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!activeWorkspace) return
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const [base, ents] = await Promise.all([
        api.get<KnowledgeBase>(
          `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}`
        ),
        api.get<Entry[]>(
          `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries`
        ),
      ])
      setKb(base)
      setEntries(ents)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (wsLoading) return
    if (!activeWorkspace) {
      setLoading(false)
      return
    }
    void load()
  }, [activeWorkspace, wsLoading, kbId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addEntry(
    content: string,
    source: string,
    meta?: Record<string, unknown>
  ) {
    if (!activeWorkspace || !content.trim()) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    const entry = await api.post<Entry>(
      `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries`,
      { content: content.trim(), metadata: { source, ...meta } }
    )
    setEntries((prev) => [entry, ...prev])
    return entry
  }

  async function handleAddText() {
    if (!textContent.trim()) return
    setAdding(true)
    try {
      await addEntry(textContent.trim(), "text")
      setTextContent("")
    } finally {
      setAdding(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const textTypes = [
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
      "text/html",
    ]
    const isText =
      textTypes.some((t) => file.type.startsWith(t)) ||
      /\.(txt|md|csv|json|html|xml)$/i.test(file.name)

    if (!isText && !/\.(pdf|docx|doc)$/i.test(file.name)) {
      setFileError(
        "Unsupported file type. Use TXT, MD, CSV, JSON, PDF, or DOCX."
      )
      return
    }

    setFileName(file.name)
    setFileError("")

    if (isText) {
      setFileStatus("reading")
      const reader = new FileReader()
      reader.onload = (ev) => {
        setFileContent((ev.target?.result as string) ?? "")
        setFileStatus("ready")
      }
      reader.onerror = () => {
        setFileStatus("error")
        setFileError("Failed to read file.")
      }
      reader.readAsText(file)
    } else {
      // Binary (PDF/DOCX) — send as multipart; content extracted server-side
      setFileStatus("ready")
      setFileContent("__binary__")
    }
  }

  async function handleAddFile() {
    if (fileStatus !== "ready" || !fileName) return

    if (fileContent === "__binary__") {
      // Store binary files as reference entries (filename + type metadata)
      setFileStatus("uploading")
      try {
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "file"
        await addEntry(`[${ext.toUpperCase()} File] ${fileName}`, "file", {
          filename: fileName,
          binary: true,
          type: ext,
        })
        setFileStatus("done")
        setTimeout(() => resetFile(), 2000)
      } catch {
        setFileStatus("error")
        setFileError("Failed to save entry.")
      }
    } else {
      setFileStatus("uploading")
      try {
        await addEntry(fileContent, "file", { filename: fileName })
        setFileStatus("done")
        setTimeout(() => resetFile(), 2000)
      } catch {
        setFileStatus("error")
        setFileError("Failed to save entry.")
      }
    }
  }

  function resetFile() {
    setFileStatus("idle")
    setFileName("")
    setFileContent("")
    setFileError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleDiscoverPages() {
    const url = websiteUrl.trim()
    if (!url) return
    try {
      new URL(url)
    } catch {
      return
    }

    setWebsitePhase("discovering")
    try {
      const res = await fetch("/api/discover-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as { urls?: string[] }
      const urls = data.urls ?? [url]
      setDiscoveredUrls(urls)
      setSelectedUrls(new Set(urls))
      setCollapsedPaths(new Set())
      setWebsitePhase("select")
    } catch {
      // Fall back to single-page add
      setDiscoveredUrls([url])
      setSelectedUrls(new Set([url]))
      setWebsitePhase("select")
    }
  }

  function handleToggleSelectNode(node: UrlNode) {
    const all = collectUrls(node)
    const state = nodeSelectionState(node, selectedUrls)
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (state === "all") {
        all.forEach((u) => next.delete(u))
      } else {
        all.forEach((u) => next.add(u))
      }
      return next
    })
  }

  function handleToggleCollapse(path: string) {
    setCollapsedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function handleSelectAll() {
    setSelectedUrls(new Set(discoveredUrls))
  }

  function handleDeselectAll() {
    setSelectedUrls(new Set())
  }

  async function handleIngestSelected() {
    if (!activeWorkspace?.id || !kbId || selectedUrls.size === 0) return
    const token = await getToken()
    if (!token) return

    // Capture IDs now — React state can change during the async loop
    const wsId = activeWorkspace.id
    const kbIdSnapshot = kbId

    const urls = [...selectedUrls]
    setWebsitePhase("ingesting")
    setIngestTotal(urls.length)
    setIngestedCount(0)

    const api = createApiClient(token)
    let done = 0

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const res = await fetch(
            `/api/proxy/workspaces/${wsId}/knowledge-bases/${kbIdSnapshot}/entries/url`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ url }),
            }
          )
          if (res.ok) {
            const entry = (await res.json()) as Entry
            setEntries((prev) => [entry, ...prev])
          } else {
            // Fallback: store as reference entry
            const entry = await api.post<Entry>(
              `/workspaces/${wsId}/knowledge-bases/${kbIdSnapshot}/entries`,
              {
                content: `[Website] ${url}`,
                metadata: { source: "website", url },
              }
            )
            setEntries((prev) => [entry, ...prev])
          }
        } catch {
          // Silent fail per URL
        } finally {
          done++
          setIngestedCount(done)
        }
      })
    )

    // Reset
    setWebsiteUrl("")
    setDiscoveredUrls([])
    setSelectedUrls(new Set())
    setWebsitePhase("input")
  }

  async function handleDelete(entryId: string) {
    if (!activeWorkspace) return
    const token = await getToken()
    if (!token) return
    const api = createApiClient(token)
    await api.delete(
      `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries/${entryId}`
    )
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    if (searchResults)
      setSearchResults((prev) => prev?.filter((e) => e.id !== entryId) ?? null)
  }

  async function handleSearch() {
    if (!activeWorkspace || !searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = createApiClient(token)
      const results = await api.post<Entry[]>(
        `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/search`,
        { query: searchQuery.trim() }
      )
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }
=======
  const { data: kb = null, isLoading: kbLoading } = useQuery<KnowledgeBase>({
    queryKey: kbKey,
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<KnowledgeBase>(`/workspaces/${wsId}/knowledge-bases/${kbId}`);
    },
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ['knowledge-base-entries', wsId, kbId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      return api.get<Entry[]>(`/workspaces/${wsId}/knowledge-bases/${kbId}/entries`);
    },
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some((e) => e.status === 'pending' || e.status === 'embedding') ? 3000 : false;
    },
  });

  const loading = kbLoading || entriesLoading;
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  if (loading || wsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!kb)
    return (
      <p className="text-sm text-muted-foreground">Knowledge base not found.</p>
    )

<<<<<<< HEAD
  const displayEntries = searchResults ?? entries

  const TABS: Array<{
    id: IngestTab
    icon: typeof NoteEditIcon
    label: string
    hint: string
  }> = [
    {
      id: "text",
      icon: NoteEditIcon,
      label: "Text",
      hint: "Paste or type content directly",
    },
    {
      id: "file",
      icon: FileUploadIcon,
      label: "File",
      hint: "TXT, MD, CSV, JSON, PDF, DOCX",
    },
    {
      id: "website",
      icon: GlobalIcon,
      label: "Website",
      hint: "Crawl a web page by URL",
    },
  ]

  return (
    // -m-6 breaks out of the layout's p-6 wrapper so the two-column UI fills edge-to-edge
    <div className="-m-6 flex flex-col" style={{ height: "calc(100% + 3rem)" }}>
      {/* Header */}
=======
  return (
    // -m-6 breaks out of the layout's p-6 wrapper so the two-column UI fills edge-to-edge
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100% + 3rem)' }}>
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="mb-0.5 flex items-center gap-3">
          <button
            onClick={() => router.push("/knowledge")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </button>
          <h1 className="text-lg font-semibold">{kb.name}</h1>
          <Badge variant="secondary" className="text-xs font-normal">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </Badge>
        </div>
        {kb.description && (
          <p className="mt-0.5 ml-7 text-sm text-muted-foreground">
            {kb.description}
          </p>
        )}
      </div>

<<<<<<< HEAD
      {/* Body — two-column */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Ingest panel */}
        <div className="flex w-80 shrink-0 flex-col border-r border-border">
          {/* Ingest tab strip */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setIngestTab(tab.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-[11px] font-medium transition-colors ${
                  ingestTab === tab.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={tab.icon} className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Text tab */}
            {ingestTab === "text" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Paste text, facts, or document chunks. Each entry is
                    embedded and indexed for retrieval.
                  </p>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Paste or type content here…"
                    rows={10}
                    className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 text-xs leading-relaxed text-foreground transition-all outline-none placeholder:text-muted-foreground/50 focus:border-ring/50 focus:ring-1 focus:ring-ring/50"
                  />
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => void handleAddText()}
                    disabled={adding || !textContent.trim()}
                  >
                    {adding ? "Adding…" : "Add entry"}
                  </Button>
                </div>
              </div>
            )}

            {/* File tab */}
            {ingestTab === "file" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Upload a file to extract and index its content. Text files
                    are read client-side; PDF and DOCX are processed
                    server-side.
                  </p>

                  {fileStatus === "idle" && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-muted-foreground/50"
                    >
                      <HugeiconsIcon
                        icon={FileUploadIcon}
                        className="size-7 text-muted-foreground"
                      />
                      <span className="text-xs font-medium text-foreground">
                        Click to upload
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        TXT, MD, CSV, JSON, PDF, DOCX
                      </span>
                    </button>
                  )}

                  {fileStatus === "reading" && (
                    <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                      <HugeiconsIcon
                        icon={Loading02Icon}
                        className="size-6 animate-spin"
                      />
                      <p className="text-xs">Reading file…</p>
                    </div>
                  )}

                  {(fileStatus === "ready" || fileStatus === "uploading") && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                        <HugeiconsIcon
                          icon={FileUploadIcon}
                          className="size-4 shrink-0 text-purple-500"
                        />
                        <p className="flex-1 truncate text-xs text-foreground">
                          {fileName}
                        </p>
                        <button
                          onClick={resetFile}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            className="size-3.5"
                          />
                        </button>
                      </div>
                      {fileContent !== "__binary__" && (
                        <p className="text-[11px] text-muted-foreground">
                          {fileContent.length.toLocaleString()} chars extracted
                        </p>
                      )}
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => void handleAddFile()}
                        disabled={fileStatus === "uploading"}
                      >
                        {fileStatus === "uploading"
                          ? "Uploading…"
                          : "Add to knowledge base"}
                      </Button>
                    </div>
                  )}

                  {fileStatus === "done" && (
                    <div className="flex flex-col items-center gap-2 py-6 text-green-600">
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        className="size-6"
                      />
                      <p className="text-xs font-medium">Added successfully</p>
                    </div>
                  )}

                  {fileStatus === "error" && (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                      <p className="text-xs font-medium text-red-600">Error</p>
                      <p className="text-[11px] text-red-600">{fileError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={resetFile}
                      >
                        Try again
                      </Button>
                    </div>
                  )}

                  {fileError && fileStatus === "idle" && (
                    <p className="text-[11px] text-red-500">{fileError}</p>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.json,.html,.xml,.pdf,.docx,.doc"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>
            )}

            {/* Website tab — non-select phases (scrollable) */}
            {ingestTab === "website" && websitePhase !== "select" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {/* Phase: input */}
                  {websitePhase === "input" && (
                    <>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Enter a website URL. We&apos;ll discover all pages via
                        sitemap and let you choose which to ingest.
                      </p>
                      <Input
                        placeholder="https://docs.example.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleDiscoverPages()
                        }}
                      />
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => void handleDiscoverPages()}
                        disabled={!websiteUrl.trim()}
                      >
                        <HugeiconsIcon
                          icon={GlobalIcon}
                          className="mr-1.5 size-3.5"
                        />
                        Discover pages
                      </Button>
                    </>
                  )}

                  {/* Phase: discovering */}
                  {websitePhase === "discovering" && (
                    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                      <HugeiconsIcon
                        icon={Loading02Icon}
                        className="size-6 animate-spin"
                      />
                      <div className="text-center">
                        <p className="text-xs font-medium text-foreground">
                          Discovering pages…
                        </p>
                        <p className="mt-0.5 text-[11px]">
                          Checking sitemap and robots.txt
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Phase: ingesting */}
                  {websitePhase === "ingesting" && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <HugeiconsIcon
                        icon={Loading02Icon}
                        className="size-6 animate-spin text-primary"
                      />
                      <div className="text-center">
                        <p className="text-xs font-medium text-foreground">
                          Ingesting pages…
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {ingestedCount} / {ingestTotal} done
                        </p>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${ingestTotal > 0 ? (ingestedCount / ingestTotal) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Website tab — select phase (flex-fill so tree uses all available height) */}
            {ingestTab === "website" &&
              websitePhase === "select" &&
              (() => {
                const tree = buildUrlTree(discoveredUrls)
                return (
                  <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between">
                      <p className="text-[11px] font-medium text-foreground">
                        {discoveredUrls.length} page
                        {discoveredUrls.length !== 1 ? "s" : ""} found
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSelectAll}
                          className="text-[10px] text-primary hover:underline"
                        >
                          All
                        </button>
                        <span className="text-[10px] text-muted-foreground/40">
                          ·
                        </span>
                        <button
                          onClick={handleDeselectAll}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          None
                        </button>
                      </div>
                    </div>

                    {/* Tree — grows to fill remaining panel height */}
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/10">
                      {tree.children.length > 0 ? (
                        <div className="py-1">
                          {tree.children.map((child) => (
                            <UrlTreeNode
                              key={child.fullPath}
                              node={child}
                              selected={selectedUrls}
                              collapsed={collapsedPaths}
                              onToggleSelect={handleToggleSelectNode}
                              onToggleCollapse={handleToggleCollapse}
                              depth={0}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-[11px] text-muted-foreground">
                            No pages discovered from sitemap.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer actions */}
                    <div className="flex shrink-0 items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {selectedUrls.size} selected
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setWebsitePhase("input")
                            setDiscoveredUrls([])
                            setSelectedUrls(new Set())
                          }}
                        >
                          Back
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleIngestSelected()}
                          disabled={selectedUrls.size === 0}
                        >
                          Ingest{" "}
                          {selectedUrls.size > 0
                            ? `${selectedUrls.size} page${selectedUrls.size !== 1 ? "s" : ""}`
                            : ""}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })()}
          </div>
        </div>

        {/* Right: entries list */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Search bar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Semantic search…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (!e.target.value) setSearchResults(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearch()
                }}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSearch()}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? "Searching…" : "Search"}
            </Button>
            {searchResults && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearchResults(null)
                  setSearchQuery("")
                }}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Results count */}
          {searchResults && (
            <div className="border-b border-border px-4 py-2">
              <p className="text-xs text-muted-foreground">
                {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}
                &quot;
              </p>
            </div>
          )}

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto">
            {displayEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <p className="text-sm text-muted-foreground">
                  {searchResults
                    ? "No results found."
                    : "No entries yet. Add content using the panel on the left."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayEntries.map((entry) => {
                  const source =
                    (entry.metadata?.source as string | undefined) ?? "text"
                  const sourceColor =
                    SOURCE_COLORS[source] ?? SOURCE_COLORS.text!
                  const sourceLabel = SOURCE_LABELS[source] ?? source
                  const filename = entry.metadata?.filename as
                    | string
                    | undefined
                  const url = entry.metadata?.url as string | undefined

                  return (
                    <div
                      key={entry.id}
                      className="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Source badge + status indicator */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${sourceColor}`}
                          >
                            {sourceLabel}
                          </span>
                          {/* Ingestion status badge */}
                          {entry.status === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                              <HugeiconsIcon
                                icon={Loading02Icon}
                                className="size-3 animate-spin"
                              />
                              Queued
                            </span>
                          )}
                          {entry.status === "embedding" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
                              <HugeiconsIcon
                                icon={Loading02Icon}
                                className="size-3 animate-spin"
                              />
                              Embedding…
                            </span>
                          )}
                          {entry.status === "failed" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                              Failed
                            </span>
                          )}
                          {filename && (
                            <span className="truncate font-mono text-[11px] text-muted-foreground">
                              {filename}
                            </span>
                          )}
                          {url && (
                            <>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-[11px] text-blue-500 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {url}
                              </a>
                              {source === "website" && (
                                <button
                                  onClick={() => handleRecrawl(url)}
                                  title="Re-crawl this URL"
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  <HugeiconsIcon
                                    icon={RepeatIcon}
                                    className="size-3"
                                  />
                                  Re-crawl
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <p className="line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                          {entry.content}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleDelete(entry.id)}
                        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete01Icon} className="size-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
=======
      <div className="flex flex-1 min-h-0">
        <KbIngestPanel
          wsId={wsId}
          kbId={kbId}
          ingestTab={ingestTab}
          setIngestTab={setIngestTab}
          websiteUrl={websiteUrl}
          setWebsiteUrl={setWebsiteUrl}
          websitePhase={websitePhase}
          setWebsitePhase={setWebsitePhase}
          discoveredUrls={discoveredUrls}
          setDiscoveredUrls={setDiscoveredUrls}
          selectedUrls={selectedUrls}
          setSelectedUrls={setSelectedUrls}
        />
        <KbEntriesList
          entries={entries}
          wsId={wsId}
          kbId={kbId}
          onRecrawl={handleRecrawl}
        />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
      </div>
    </div>
  )
}
