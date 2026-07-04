"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useWorkspace } from "@/contexts/workspace-context"
import { useApiClient } from "@/hooks/use-api-client"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Badge } from "@linea/ui/components/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { KbIngestPanel } from "./kb-ingest-panel"
import { KbEntriesList } from "./kb-entries-list"
import type { KnowledgeBase, Entry } from "./kb-types"

type IngestTab = "text" | "file" | "website"
type WebsitePhase = "input" | "discovering" | "select" | "ingesting"

export default function KnowledgeBaseDetailPage() {
  const { kbId } = useParams<{ kbId: string }>()
  const getApi = useApiClient()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const router = useRouter()
  const wsId = activeWorkspace?.id ?? ""
  const kbKey = ["knowledge-base", wsId, kbId]

  // Lifted so the entries list's "Re-crawl" action can jump the ingest panel to the website tab
  const [ingestTab, setIngestTab] = useState<IngestTab>("text")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [websitePhase, setWebsitePhase] = useState<WebsitePhase>("input")
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

  function handleRecrawl(url: string) {
    setIngestTab("website")
    setWebsiteUrl(url)
    setWebsitePhase("input")
    setDiscoveredUrls([])
    setSelectedUrls(new Set())
  }

  const { data: kb = null, isLoading: kbLoading } = useQuery<KnowledgeBase>({
    queryKey: kbKey,
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<KnowledgeBase>(
        `/workspaces/${wsId}/knowledge-bases/${kbId}`
      )
    },
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ["knowledge-base-entries", wsId, kbId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      return api.get<Entry[]>(
        `/workspaces/${wsId}/knowledge-bases/${kbId}/entries`
      )
    },
    refetchInterval: (query) => {
      const list = query.state.data ?? []
      return list.some(
        (e) => e.status === "pending" || e.status === "embedding"
      )
        ? 3000
        : false
    },
  })

  const loading = kbLoading || entriesLoading

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

  return (
    // -m-6 breaks out of the layout's p-6 wrapper so the two-column UI fills edge-to-edge
    <div className="-m-6 flex flex-col" style={{ height: "calc(100% + 3rem)" }}>
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

      <div className="flex min-h-0 flex-1">
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
      </div>
    </div>
  )
}
