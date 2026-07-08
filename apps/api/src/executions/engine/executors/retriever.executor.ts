import type { WorkflowState } from '../variable-substitution.js';

export interface RetrieverNodeData {
  query?: string;
  knowledgeBaseId?: string;
  namespaceId?: string;
  topK?: number;
  outputField?: string; // 'documents' | 'text' | 'full' (default: 'documents')
  outputKey?: string; // panel field — used as variable name; ignored by format logic
}

/** Retriever node — hybrid search against a knowledge base via the injected query callback. */
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
  if (!kbId) {
    throw new Error('Retriever node is missing a knowledgeBaseId');
  }
  if (!db) {
    throw new Error('Retriever node has no query backend configured');
  }

  const documents = await db.query(query, kbId, topK);

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
