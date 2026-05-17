import type { WorkflowState } from '../variable-substitution';
import type { MemoryService } from '../memory.service';

export interface MemoryNodeData {
  memoryMode?: 'smart' | 'retrieve' | 'write' | 'delete' | 'clear';
  memoryScope?: 'thread' | 'workflow' | 'session';
  memoryKey?: string;
  memoryValue?: string; // write mode — supports {{variable}} (already substituted by caller)
  memoryQuery?: string; // retrieve mode — keyword filter
  memoryTopK?: number;  // retrieve mode — max results
  memorySessionKey?: string; // session scope — resolved caller identifier
}

export interface MemoryExecutorContext {
  workspaceId: string;
  workflowId?: string;
  threadId: string;
  service: MemoryService;
}

export async function executeMemoryNode(
  nodeData: MemoryNodeData,
  state: WorkflowState,
  ctx?: MemoryExecutorContext,
): Promise<unknown> {
  const mode = nodeData.memoryMode ?? 'retrieve';
  const scope = (nodeData.memoryScope ?? 'thread') as 'thread' | 'workflow' | 'session';

  // Legacy fallback: no context → operate on in-memory state only
  if (!ctx) {
    const memory = state.memory ?? {};
    if (mode === 'retrieve') {
      const query = (nodeData.memoryQuery ?? '').toLowerCase();
      const topK = nodeData.memoryTopK ?? 5;
      const entries = Object.entries(memory).map(([key, value]) => ({
        key,
        value,
        text: typeof value === 'string' ? value : JSON.stringify(value),
      }));
      const matches = query
        ? entries.filter((e) => e.key.toLowerCase().includes(query) || e.text.toLowerCase().includes(query))
        : entries;
      const top = matches.slice(0, topK);
      return { memories: top, count: top.length, query };
    }
    if (mode === 'clear') {
      return { __clearMemory: true, scope };
    }
    return { memory, count: Object.keys(memory).length };
  }

  const { workspaceId, workflowId, threadId, service } = ctx;
  const sessionKey = nodeData.memorySessionKey || undefined;

  switch (mode) {
    case 'write': {
      const key = (nodeData.memoryKey ?? '').trim();
      if (!key) return { error: 'memoryKey is required for write mode' };
      let value: unknown = nodeData.memoryValue;
      try {
        value = JSON.parse(nodeData.memoryValue ?? '');
      } catch { /* keep as string */ }
      await service.writeEntry(workspaceId, workflowId, threadId, scope, sessionKey, key, value);
      return { written: true, key, scope };
    }

    case 'delete': {
      const key = (nodeData.memoryKey ?? '').trim();
      if (!key) return { error: 'memoryKey is required for delete mode' };
      await service.deleteEntry(workspaceId, workflowId, threadId, scope, sessionKey, key);
      return { deleted: true, key, scope };
    }

    case 'retrieve': {
      const query = nodeData.memoryQuery ?? '';
      const topK = nodeData.memoryTopK ?? 5;
      const entries = await service.readEntries(workspaceId, workflowId, threadId, scope, sessionKey, query, topK);
      return { memories: entries, count: entries.length, query };
    }

    case 'clear':
      return { __clearMemory: true, scope };

    case 'smart':
    default: {
      const memory = state.memory ?? {};
      return { memory, count: Object.keys(memory).length };
    }
  }
}
