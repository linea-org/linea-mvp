export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
}

export type EntryStatus = 'pending' | 'embedding' | 'indexed' | 'failed';

export interface Entry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  status: EntryStatus;
  createdAt: string;
}
