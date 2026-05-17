'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Badge } from '@linea/ui/components/badge';
import { HugeiconsIcon } from '@hugeicons/react';
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
} from '@hugeicons/core-free-icons';
import { useRouter } from 'next/navigation';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
}

interface Entry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type IngestTab = 'text' | 'file' | 'website';
type FileStatus = 'idle' | 'reading' | 'ready' | 'uploading' | 'done' | 'error';

const SOURCE_LABELS: Record<string, string> = {
  text: 'Text',
  file: 'File',
  website: 'Website',
};

const SOURCE_COLORS: Record<string, string> = {
  text: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900 dark:text-blue-400',
  file: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900 dark:text-purple-400',
  website: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-900 dark:text-green-400',
};

export default function KnowledgeBaseDetailPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Ingestion state
  const [ingestTab, setIngestTab] = useState<IngestTab>('text');
  const [textContent, setTextContent] = useState('');
  const [adding, setAdding] = useState(false);

  // File ingestion
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileError, setFileError] = useState('');

  // Website ingestion
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [crawling, setCrawling] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function load() {
    if (!activeWorkspace) return;
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const [base, ents] = await Promise.all([
        api.get<KnowledgeBase>(`/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}`),
        api.get<Entry[]>(`/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries`),
      ]);
      setKb(base);
      setEntries(ents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading, kbId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addEntry(content: string, source: string, meta?: Record<string, unknown>) {
    if (!activeWorkspace || !content.trim()) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const entry = await api.post<Entry>(
      `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries`,
      { content: content.trim(), metadata: { source, ...meta } },
    );
    setEntries((prev) => [entry, ...prev]);
    return entry;
  }

  async function handleAddText() {
    if (!textContent.trim()) return;
    setAdding(true);
    try {
      await addEntry(textContent.trim(), 'text');
      setTextContent('');
    } finally {
      setAdding(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html'];
    const isText = textTypes.some((t) => file.type.startsWith(t)) || /\.(txt|md|csv|json|html|xml)$/i.test(file.name);

    if (!isText && !/\.(pdf|docx|doc)$/i.test(file.name)) {
      setFileError('Unsupported file type. Use TXT, MD, CSV, JSON, PDF, or DOCX.');
      return;
    }

    setFileName(file.name);
    setFileError('');

    if (isText) {
      setFileStatus('reading');
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFileContent((ev.target?.result as string) ?? '');
        setFileStatus('ready');
      };
      reader.onerror = () => { setFileStatus('error'); setFileError('Failed to read file.'); };
      reader.readAsText(file);
    } else {
      // Binary (PDF/DOCX) — send as multipart; content extracted server-side
      setFileStatus('ready');
      setFileContent('__binary__');
    }
  }

  async function handleAddFile() {
    if (fileStatus !== 'ready' || !fileName) return;

    if (fileContent === '__binary__') {
      // Multipart upload for binary files
      if (!activeWorkspace) return;
      setFileStatus('uploading');
      try {
        const token = await getToken();
        if (!token) return;
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(
          `/api/proxy/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries/file`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
        );
        if (!res.ok) throw new Error('Upload failed');
        const entry = await res.json() as Entry;
        setEntries((prev) => [entry, ...prev]);
        setFileStatus('done');
        setTimeout(() => resetFile(), 2000);
      } catch {
        setFileStatus('error');
        setFileError('Upload failed. The server may not support binary ingestion yet.');
      }
    } else {
      setFileStatus('uploading');
      try {
        await addEntry(fileContent, 'file', { filename: fileName });
        setFileStatus('done');
        setTimeout(() => resetFile(), 2000);
      } catch {
        setFileStatus('error');
        setFileError('Failed to save entry.');
      }
    }
  }

  function resetFile() {
    setFileStatus('idle');
    setFileName('');
    setFileContent('');
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleAddWebsite() {
    const url = websiteUrl.trim();
    if (!url || !activeWorkspace) return;

    try { new URL(url); } catch { return; }

    setCrawling(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `/api/proxy/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries/url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url }),
        },
      );
      if (!res.ok) throw new Error('Crawl failed');
      const entry = await res.json() as Entry;
      setEntries((prev) => [entry, ...prev]);
      setWebsiteUrl('');
    } catch {
      // Fallback: store the URL as a reference entry
      await addEntry(`[Website] ${url}`, 'website', { url });
      setWebsiteUrl('');
    } finally {
      setCrawling(false);
    }
  }

  async function handleDelete(entryId: string) {
    if (!activeWorkspace) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    await api.delete(`/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries/${entryId}`);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (searchResults) setSearchResults((prev) => prev?.filter((e) => e.id !== entryId) ?? null);
  }

  async function handleSearch() {
    if (!activeWorkspace || !searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const results = await api.post<Entry[]>(
        `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/search`,
        { query: searchQuery.trim() },
      );
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  if (loading || wsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!kb) return <p className="text-sm text-muted-foreground">Knowledge base not found.</p>;

  const displayEntries = searchResults ?? entries;

  const TABS: Array<{ id: IngestTab; icon: typeof NoteEditIcon; label: string; hint: string }> = [
    { id: 'text',    icon: NoteEditIcon,   label: 'Text',    hint: 'Paste or type content directly' },
    { id: 'file',    icon: FileUploadIcon, label: 'File',    hint: 'TXT, MD, CSV, JSON, PDF, DOCX' },
    { id: 'website', icon: GlobalIcon,     label: 'Website', hint: 'Crawl a web page by URL' },
  ];

  return (
    // -m-6 breaks out of the layout's p-6 wrapper so the two-column UI fills edge-to-edge
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100% + 3rem)' }}>
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-0.5">
          <button
            onClick={() => router.push('/knowledge')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </button>
          <h1 className="text-lg font-semibold">{kb.name}</h1>
          <Badge variant="secondary" className="text-xs font-normal">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Badge>
        </div>
        {kb.description && (
          <p className="text-sm text-muted-foreground mt-0.5 ml-7">{kb.description}</p>
        )}
      </div>

      {/* Body — two-column */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Ingest panel */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          {/* Ingest tab strip */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setIngestTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                  ingestTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <HugeiconsIcon icon={tab.icon} className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Text tab */}
            {ingestTab === 'text' && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">Paste text, facts, or document chunks. Each entry is embedded and indexed for retrieval.</p>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste or type content here…"
                  rows={10}
                  className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring/50 focus:border-ring/50 transition-all leading-relaxed"
                />
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => void handleAddText()}
                  disabled={adding || !textContent.trim()}
                >
                  {adding ? 'Adding…' : 'Add entry'}
                </Button>
              </div>
            )}

            {/* File tab */}
            {ingestTab === 'file' && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Upload a file to extract and index its content. Text files are read client-side; PDF and DOCX are processed server-side.
                </p>

                {fileStatus === 'idle' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/50 p-6 flex flex-col items-center gap-2 transition-colors text-center"
                  >
                    <HugeiconsIcon icon={FileUploadIcon} className="size-7 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Click to upload</span>
                    <span className="text-[11px] text-muted-foreground">TXT, MD, CSV, JSON, PDF, DOCX</span>
                  </button>
                )}

                {fileStatus === 'reading' && (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <HugeiconsIcon icon={Loading02Icon} className="size-6 animate-spin" />
                    <p className="text-xs">Reading file…</p>
                  </div>
                )}

                {(fileStatus === 'ready' || fileStatus === 'uploading') && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                      <HugeiconsIcon icon={FileUploadIcon} className="size-4 text-purple-500 shrink-0" />
                      <p className="text-xs text-foreground truncate flex-1">{fileName}</p>
                      <button onClick={resetFile} className="text-muted-foreground hover:text-foreground shrink-0">
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                      </button>
                    </div>
                    {fileContent !== '__binary__' && (
                      <p className="text-[11px] text-muted-foreground">{fileContent.length.toLocaleString()} chars extracted</p>
                    )}
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => void handleAddFile()}
                      disabled={fileStatus === 'uploading'}
                    >
                      {fileStatus === 'uploading' ? 'Uploading…' : 'Add to knowledge base'}
                    </Button>
                  </div>
                )}

                {fileStatus === 'done' && (
                  <div className="flex flex-col items-center gap-2 py-6 text-green-600">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-6" />
                    <p className="text-xs font-medium">Added successfully</p>
                  </div>
                )}

                {fileStatus === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 space-y-2">
                    <p className="text-xs font-medium text-red-600">Error</p>
                    <p className="text-[11px] text-red-600">{fileError}</p>
                    <Button variant="outline" size="sm" className="w-full" onClick={resetFile}>Try again</Button>
                  </div>
                )}

                {fileError && fileStatus === 'idle' && (
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
            )}

            {/* Website tab */}
            {ingestTab === 'website' && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Enter a URL to crawl and index its text content. The page is fetched and chunked server-side.
                </p>
                <Input
                  placeholder="https://example.com/docs/page"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleAddWebsite(); }}
                />
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => void handleAddWebsite()}
                  disabled={crawling || !websiteUrl.trim()}
                >
                  {crawling ? 'Crawling…' : 'Crawl & index'}
                </Button>
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tips</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">Point to a specific page, not a domain root, for best results.</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">JavaScript-heavy pages may return limited content.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: entries list */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Search bar */}
          <div className="shrink-0 flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative flex-1">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Semantic search…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => void handleSearch()} disabled={searching || !searchQuery.trim()}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
            {searchResults && (
              <Button size="sm" variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Results count */}
          {searchResults && (
            <div className="px-4 py-2 border-b border-border">
              <p className="text-xs text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
              </p>
            </div>
          )}

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto">
            {displayEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <p className="text-sm text-muted-foreground">
                  {searchResults ? 'No results found.' : 'No entries yet. Add content using the panel on the left.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayEntries.map((entry) => {
                  const source = (entry.metadata?.source as string | undefined) ?? 'text';
                  const sourceColor = SOURCE_COLORS[source] ?? SOURCE_COLORS.text!;
                  const sourceLabel = SOURCE_LABELS[source] ?? source;
                  const filename = entry.metadata?.filename as string | undefined;
                  const url = entry.metadata?.url as string | undefined;

                  return (
                    <div key={entry.id} className="group flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Source badge */}
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${sourceColor}`}>
                            {sourceLabel}
                          </span>
                          {filename && (
                            <span className="text-[11px] text-muted-foreground truncate font-mono">{filename}</span>
                          )}
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-500 hover:underline truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {url}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
                          {entry.content}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleDelete(entry.id)}
                        className="shrink-0 mt-0.5 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <HugeiconsIcon icon={Delete01Icon} className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
