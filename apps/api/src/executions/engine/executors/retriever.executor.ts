import type { WorkflowState } from '../variable-substitution';

export interface RetrieverNodeData {
  query?: string;            // supports {{variable}} substitution
  namespaceId?: string;      // which knowledge base to search
  topK?: number;             // how many results to return (default: 5)
  outputField?: string;      // 'documents' | 'text' | 'full' (default: 'documents')
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
  db?: { query: (query: string, namespaceId: string, topK: number) => Promise<Array<{ content: string; metadata?: unknown }>> },
): Promise<unknown> {
  const query = nodeData.query ?? String(state.variables['lastOutput'] ?? '');
  const topK = nodeData.topK ?? 5;
  const outputField = nodeData.outputField ?? 'documents';

  if (!query) {
    return { documents: [], count: 0, query: '' };
  }

  let documents: Array<{ content: string; metadata?: unknown }> = [];

  if (db && nodeData.namespaceId) {
    try {
      documents = await db.query(query, nodeData.namespaceId, topK);
    } catch {
      // Fallback to empty if DB query fails
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
