'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  Delete01Icon,
  Cancel01Icon,
  Loading02Icon,
  RepeatIcon,
} from '@hugeicons/core-free-icons';
import type { Entry } from './kb-types';

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

export function KbEntriesList({
  entries,
  wsId,
  kbId,
  onRecrawl,
}: {
  entries: Entry[];
  wsId: string;
  kbId: string;
  onRecrawl: (url: string) => void;
}) {
  const getApi = useApiClient();
  const queryClient = useQueryClient();
  const entriesKey = ['knowledge-base-entries', wsId, kbId];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/knowledge-bases/${kbId}/entries/${entryId}`);
      return entryId;
    },
    onSuccess: (entryId) => {
      queryClient.setQueryData<Entry[]>(entriesKey, (prev = []) => prev.filter((e) => e.id !== entryId));
      if (searchResults) setSearchResults((prev) => prev?.filter((e) => e.id !== entryId) ?? null);
    },
  });

  async function handleSearch() {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const api = await getApi();
      const results = await api.post<Entry[]>(
        `/workspaces/${wsId}/knowledge-bases/${kbId}/search`,
        { query: searchQuery.trim() },
      );
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  const displayEntries = searchResults ?? entries;

  return (
    <div className="flex flex-1 min-w-0 flex-col">
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

      {searchResults && (
        <div className="px-4 py-2 border-b border-border">
          <p className="text-xs text-muted-foreground">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </p>
        </div>
      )}

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
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${sourceColor}`}>
                        {sourceLabel}
                      </span>
                      {entry.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin" />
                          Queued
                        </span>
                      )}
                      {entry.status === 'embedding' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin" />
                          Embedding…
                        </span>
                      )}
                      {entry.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                          Failed
                        </span>
                      )}
                      {filename && (
                        <span className="text-[11px] text-muted-foreground truncate font-mono">{filename}</span>
                      )}
                      {url && (
                        <>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-500 hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {url}
                          </a>
                          {source === 'website' && (
                            <button
                              onClick={() => onRecrawl(url)}
                              title="Re-crawl this URL"
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <HugeiconsIcon icon={RepeatIcon} className="size-3" />
                              Re-crawl
                            </button>
                          )}
                        </>
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
                    onClick={() => deleteEntry.mutate(entry.id)}
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
  );
}
