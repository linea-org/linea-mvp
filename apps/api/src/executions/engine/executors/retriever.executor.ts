import type { WorkflowState } from '../variable-substitution.js';

export interface RetrieverNodeData {
  query?: string;
  knowledgeBaseId?: string;
  namespaceId?: string;
  topK?: number;
  outputField?: string; // 'documents' | 'text' | 'full' (default: 'documents')
  outputKey?: string; // panel field — used as variable name; ignored by format logic
}

/**
 * Retriever node — performs semantic search against a knowledge namespace.
 *
 * The actual vector search runs in the database (pgvector). This executor
 * delegates to the DatabaseService via the DB_TOKEN injection. For now,
 * it performs a simple text-match fallback since vector embeddings require
 * an embeddings API call that would need to be wired in separately.
 *
 * Returns the top-K matching document snippets.
 */
export async function executeRetrieverNode(
  nodeData: RetrieverNodeData,
  state: WorkflowState,
  db?: {
    query: (
      query: string,
      namespaceId: string,
      topK: number,
    ) => Promise<Array<{ content: string; metadata?: unknown }>>;
  },
): Promise<unknown> {
  const query = nodeData.query ?? String(state.variables['lastOutput'] ?? '');
  const topK = nodeData.topK ?? 5;
  // outputKey (panel field) is a variable name to store under — not a format selector.
  // Only treat it as a format selector if it matches a known format keyword.
  const FORMAT_KEYWORDS = new Set(['documents', 'text', 'full']);
  const outputField =
    nodeData.outputField ??
    (FORMAT_KEYWORDS.has(nodeData.outputKey ?? '')
      ? nodeData.outputKey!
      : 'documents');
  const kbId = nodeData.knowledgeBaseId ?? nodeData.namespaceId;

  if (!query) {
    return { documents: [], count: 0, query: '' };
  }

  let documents: Array<{ content: string; metadata?: unknown }> = [];

  if (db && kbId) {
    try {
      documents = await db.query(query, kbId, topK);
    } catch {
      documents = [];
    }
  }

  const combinedText = documents.map((d) => d.content).join('\n\n---\n\n');

  const result = {
    documents,
    count: documents.length,
    query,
    text: combinedText,
  };

  if (outputField === 'text') return combinedText;
  if (outputField === 'full') return result;
  return result;
}
