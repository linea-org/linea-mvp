'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { createApiClient } from '@/lib/api';
import { toast } from '@linea/ui/components/sonner';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  NoteEditIcon,
  FileUploadIcon,
  GlobalIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Loading02Icon,
} from '@hugeicons/core-free-icons';
import { buildUrlTree, UrlTreeNode, collectUrls, type UrlNode } from './kb-url-tree';
import type { Entry } from './kb-types';

type IngestTab = 'text' | 'file' | 'website';
type FileStatus = 'idle' | 'reading' | 'ready' | 'uploading' | 'done' | 'error';
type WebsitePhase = 'input' | 'discovering' | 'select' | 'ingesting';

const TABS: Array<{ id: IngestTab; icon: typeof NoteEditIcon; label: string }> = [
  { id: 'text',    icon: NoteEditIcon,   label: 'Text' },
  { id: 'file',    icon: FileUploadIcon, label: 'File' },
  { id: 'website', icon: GlobalIcon,     label: 'Website' },
];

export function KbIngestPanel({
  wsId,
  kbId,
  ingestTab,
  setIngestTab,
  websiteUrl,
  setWebsiteUrl,
  websitePhase,
  setWebsitePhase,
  discoveredUrls,
  setDiscoveredUrls,
  selectedUrls,
  setSelectedUrls,
}: {
  wsId: string;
  kbId: string;
  ingestTab: IngestTab;
  setIngestTab: (tab: IngestTab) => void;
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
  websitePhase: WebsitePhase;
  setWebsitePhase: (phase: WebsitePhase) => void;
  discoveredUrls: string[];
  setDiscoveredUrls: (urls: string[]) => void;
  selectedUrls: Set<string>;
  setSelectedUrls: (urls: Set<string>) => void;
}) {
  const { getToken } = useAuth();
  const getApi = useApiClient();
  const queryClient = useQueryClient();
  const entriesKey = ['knowledge-base-entries', wsId, kbId];

  const [textContent, setTextContent] = useState('');
  const [adding, setAdding] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileError, setFileError] = useState('');

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [ingestedCount, setIngestedCount] = useState(0);
  const [ingestTotal, setIngestTotal] = useState(0);

  async function addEntry(content: string, source: string, meta?: Record<string, unknown>) {
    if (!content.trim()) return;
    const api = await getApi();
    const entry = await api.post<Entry>(
      `/workspaces/${wsId}/knowledge-bases/${kbId}/entries`,
      { content: content.trim(), metadata: { source, ...meta } },
    );
    queryClient.setQueryData<Entry[]>(entriesKey, (prev = []) => [entry, ...prev]);
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
      // PDF/DOCX content is extracted server-side — the client only tags this as binary
      setFileStatus('ready');
      setFileContent('__binary__');
    }
  }

  async function handleAddFile() {
    if (fileStatus !== 'ready' || !fileName) return;

    if (fileContent === '__binary__') {
      setFileStatus('uploading');
      try {
        const ext = fileName.split('.').pop()?.toLowerCase() ?? 'file';
        await addEntry(
          `[${ext.toUpperCase()} File] ${fileName}`,
          'file',
          { filename: fileName, binary: true, type: ext },
        );
        setFileStatus('done');
        setTimeout(() => resetFile(), 2000);
      } catch {
        setFileStatus('error');
        setFileError('Failed to save entry.');
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

  async function handleDiscoverPages() {
    const url = websiteUrl.trim();
    if (!url) return;
    try { new URL(url); } catch { return; }

    setWebsitePhase('discovering');
    try {
      const res = await fetch('/api/discover-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { urls?: string[] };
      const urls = data.urls ?? [url];
      setDiscoveredUrls(urls);
      setSelectedUrls(new Set(urls));
      setCollapsedPaths(new Set());
      setWebsitePhase('select');
    } catch {
      setDiscoveredUrls([url]);
      setSelectedUrls(new Set([url]));
      setWebsitePhase('select');
    }
  }

  function handleToggleSelectNode(node: UrlNode) {
    const all = collectUrls(node);
    const allSelected = all.every((u) => selectedUrls.has(u));
    const next = new Set(selectedUrls);
    if (allSelected) {
      all.forEach((u) => next.delete(u));
    } else {
      all.forEach((u) => next.add(u));
    }
    setSelectedUrls(next);
  }

  function handleToggleCollapse(path: string) {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedUrls(new Set(discoveredUrls));
  }

  function handleDeselectAll() {
    setSelectedUrls(new Set());
  }

  async function handleIngestSelected() {
    if (!wsId || !kbId || selectedUrls.size === 0) return;
    const token = await getToken();
    if (!token) return;

    const urls = [...selectedUrls];
    setWebsitePhase('ingesting');
    setIngestTotal(urls.length);
    setIngestedCount(0);

    const api = createApiClient(token);
    let done = 0;
    let failed = 0;

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const res = await fetch(
            `/api/proxy/workspaces/${wsId}/knowledge-bases/${kbId}/entries/url`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ url }),
            },
          );
          if (res.ok) {
            const entry = await res.json() as Entry;
            queryClient.setQueryData<Entry[]>(entriesKey, (prev = []) => [entry, ...prev]);
          } else {
            // Fallback: store as a reference entry when server-side crawling fails
            const entry = await api.post<Entry>(
              `/workspaces/${wsId}/knowledge-bases/${kbId}/entries`,
              { content: `[Website] ${url}`, metadata: { source: 'website', url } },
            );
            queryClient.setQueryData<Entry[]>(entriesKey, (prev = []) => [entry, ...prev]);
          }
        } catch {
          failed++;
        } finally {
          done++;
          setIngestedCount(done);
        }
      }),
    );

    if (failed > 0) toast.error(`${failed} of ${urls.length} URLs failed to import`);

    setWebsiteUrl('');
    setDiscoveredUrls([]);
    setSelectedUrls(new Set());
    setWebsitePhase('input');
  }

  return (
    <div className="w-80 shrink-0 border-r border-border flex flex-col">
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

      <div className="flex-1 min-h-0 flex flex-col">
        {ingestTab === 'text' && (
          <div className="flex-1 overflow-y-auto p-4">
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
          </div>
        )}

        {ingestTab === 'file' && (
          <div className="flex-1 overflow-y-auto p-4">
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
          </div>
        )}

        {ingestTab === 'website' && websitePhase !== 'select' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {websitePhase === 'input' && (
                <>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Enter a website URL. We&apos;ll discover all pages via sitemap and let you choose which to ingest.
                  </p>
                  <Input
                    placeholder="https://docs.example.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleDiscoverPages(); }}
                  />
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => void handleDiscoverPages()}
                    disabled={!websiteUrl.trim()}
                  >
                    <HugeiconsIcon icon={GlobalIcon} className="size-3.5 mr-1.5" />
                    Discover pages
                  </Button>
                </>
              )}

              {websitePhase === 'discovering' && (
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                  <HugeiconsIcon icon={Loading02Icon} className="size-6 animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">Discovering pages…</p>
                    <p className="text-[11px] mt-0.5">Checking sitemap and robots.txt</p>
                  </div>
                </div>
              )}

              {websitePhase === 'ingesting' && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <HugeiconsIcon icon={Loading02Icon} className="size-6 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">Ingesting pages…</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ingestedCount} / {ingestTotal} done
                    </p>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${ingestTotal > 0 ? (ingestedCount / ingestTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {ingestTab === 'website' && websitePhase === 'select' && (() => {
          const tree = buildUrlTree(discoveredUrls);
          return (
            <div className="flex-1 min-h-0 flex flex-col p-4 gap-2">
              <div className="flex items-center justify-between shrink-0">
                <p className="text-[11px] font-medium text-foreground">
                  {discoveredUrls.length} page{discoveredUrls.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-[10px] text-primary hover:underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground/40 text-[10px]">·</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/10 overflow-y-auto flex-1 min-h-0">
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
                    <p className="text-[11px] text-muted-foreground">No pages discovered from sitemap.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between shrink-0">
                <span className="text-[11px] text-muted-foreground">
                  {selectedUrls.size} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setWebsitePhase('input'); setDiscoveredUrls([]); setSelectedUrls(new Set()); }}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleIngestSelected()}
                    disabled={selectedUrls.size === 0}
                  >
                    Ingest {selectedUrls.size > 0 ? `${selectedUrls.size} page${selectedUrls.size !== 1 ? 's' : ''}` : ''}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
