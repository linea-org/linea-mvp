import type { WorkflowState } from '../variable-substitution';

export interface MemoryNodeData {
  memoryMode?: 'smart' | 'retrieve' | 'clear';
  memoryScope?: 'thread' | 'workflow' | 'user';
  memoryQuery?: string;   // retrieve mode — what to search
  memoryTopK?: number;    // retrieve mode — how many results
  memoryAgentId?: string; // attribution tag
}

/**
 * Execute a memory node.
 *
 * - retrieve: returns matching entries from state.memory as an array
 * - clear:    signals the runner to wipe the relevant scope
 * - smart:    LLM-managed; the agent executor handles this via tool calls.
 *             At the node level we just pass through and let the caller handle it.
 */
export function executeMemoryNode(
  nodeData: MemoryNodeData,
  state: WorkflowState,
): unknown {
  const mode = nodeData.memoryMode ?? 'retrieve';
  const memory = state.memory ?? {};

  switch (mode) {
    case 'retrieve': {
      const query = (nodeData.memoryQuery ?? '').toLowerCase();
      const topK = nodeData.memoryTopK ?? 5;

      const entries = Object.entries(memory).map(([key, value]) => ({
        key,
        value,
        text: typeof value === 'string' ? value : JSON.stringify(value),
      }));

      const matches = query
        ? entries.filter(
            (e) =>
              e.key.toLowerCase().includes(query) ||
              e.text.toLowerCase().includes(query),
          )
        : entries;

      const top = matches.slice(0, topK);

      return {
        memories: top,
        count: top.length,
        query,
      };
    }

    case 'clear':
      // Signal to the LangGraph reducer to wipe memory
      return { __clearMemory: true, scope: nodeData.memoryScope ?? 'thread' };

    case 'smart':
    default:
      // smart mode is managed by the agent executor via tool calls
      // Return current memory snapshot for the agent to reason about
      return { memory, count: Object.keys(memory).length };
  }
}
