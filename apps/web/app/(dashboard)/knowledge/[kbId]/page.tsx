'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Separator } from '@linea/ui/components/separator';
import { ScrollArea } from '@linea/ui/components/scroll-area';

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

export default function KnowledgeBaseDetailPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding] = useState(false);
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
    if (!wsLoading && activeWorkspace) void load();
  }, [activeWorkspace, wsLoading, kbId]);

  async function handleAdd() {
    if (!activeWorkspace || !newContent.trim()) return;
    setAdding(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const entry = await api.post<Entry>(
        `/workspaces/${activeWorkspace.id}/knowledge-bases/${kbId}/entries`,
        { content: newContent.trim() },
      );
      setEntries((prev) => [entry, ...prev]);
      setNewContent('');
    } finally {
      setAdding(false);
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
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (!kb) return <p className="text-sm text-muted-foreground">Knowledge base not found.</p>;

  const displayEntries = searchResults ?? entries;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">{kb.name}</h1>
        {kb.description && <p className="text-sm text-muted-foreground mt-1">{kb.description}</p>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search entries…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
          className="flex-1"
        />
        <Button variant="outline" onClick={() => void handleSearch()} disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
        {searchResults && (
          <Button variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
            Clear
          </Button>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Add an entry — paste text, a fact, or a document chunk…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void handleAdd(); }}
            className="flex-1"
          />
          <Button onClick={() => void handleAdd()} disabled={adding || !newContent.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>

        {searchResults && (
          <p className="text-xs text-muted-foreground">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}

        <ScrollArea className="h-[500px]">
          <div className="space-y-2 pr-2">
            {displayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {searchResults ? 'No results found.' : 'No entries yet.'}
              </p>
            ) : (
              displayEntries.map((entry) => (
                <div key={entry.id} className="group rounded-lg border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                      onClick={() => void handleDelete(entry.id)}
                    >
                      Delete
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
