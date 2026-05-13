import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
  Command,
  interrupt,
  isGraphInterrupt,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { workflows } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';
import { NodeExecutorService } from './node-executor.service';
import type { WorkflowState } from './variable-substitution';

export interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type NodeUpdateCallback = (
  nodeId: string,
  status: 'running' | 'completed' | 'failed' | 'suspended',
  output?: any,
  error?: string,
) => void;

export const WorkflowStateAnnotation = Annotation.Root({
  variables: Annotation<Record<string, any>>({
    reducer: (l, r) => ({ ...l, ...r }),
    default: () => ({ input: '', lastOutput: '' }),
  }),
  chatHistory: Annotation<Array<{ role: string; content: string }>>({
    reducer: (l, r) => [...l, ...r],
    default: () => [],
  }),
  memory: Annotation<Record<string, any>>({
    reducer: (l, r) => ({ ...l, ...r }),
    default: () => ({}),
  }),
  currentNodeId: Annotation<string>({
    reducer: (_, r) => r,
    default: () => '',
  }),
  nodeResults: Annotation<Record<string, any>>({
    reducer: (l, r) => ({ ...l, ...r }),
    default: () => ({}),
  }),
  pendingAuth: Annotation<any>({
    reducer: (_, r) => r,
    default: () => null,
  }),
  loopResults: Annotation<Array<any>>({
    reducer: (l, r) => [...l, ...r],
    default: () => [],
  }),
  cumulativeUsage: Annotation<{
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  }>({
    reducer: (l, r) => ({
      input_tokens: (l?.input_tokens || 0) + (r?.input_tokens || 0),
      output_tokens: (l?.output_tokens || 0) + (r?.output_tokens || 0),
      total_tokens: (l?.total_tokens || 0) + (r?.total_tokens || 0),
    }),
    default: () => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0 }),
  }),
});

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);

  constructor(
    private readonly nodeExecutor: NodeExecutorService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {}

  buildGraph(
    definition: WorkflowDefinition,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    checkpointer?: BaseCheckpointSaver,
    workflowId?: string,
    threadId?: string,
  ) {
    const saver = checkpointer ?? new MemorySaver();
    const builder = new StateGraph(WorkflowStateAnnotation);

    const validIds = new Set(definition.nodes.map((n) => n.id));
    const edgesBySource = new Map<string, WorkflowEdge[]>();

    for (const edge of definition.edges) {
      if (!validIds.has(edge.source) || !validIds.has(edge.target)) continue;
      const list = edgesBySource.get(edge.source) ?? [];
      list.push(edge);
      edgesBySource.set(edge.source, list);
    }

    for (const node of definition.nodes) {
      const nodeType = node.data?.nodeType || node.type;
      if (nodeType === 'note') continue;
      builder.addNode(
        node.id,
        this.createNodeFn(node, onNodeUpdate, workspaceId, checkpointer, workflowId, threadId),
      );
    }

    const conditionals = new Set<string>();

    for (const [sourceId, edges] of edgesBySource) {
      const sourceNode = definition.nodes.find((n) => n.id === sourceId);
      const sourceType = sourceNode?.data?.nodeType || sourceNode?.type;
      if (!sourceNode || sourceType === 'note') continue;

      if (
        sourceType === 'if-else' ||
        sourceType === 'if / else' ||
        sourceType === 'router'
      ) {
        if (!conditionals.has(sourceId)) {
          const pathMap: Record<string, string> = {};
          for (const edge of edges)
            pathMap[edge.sourceHandle || edge.label || 'default'] = edge.target;
          builder.addConditionalEdges(
            sourceId as any,
            this.createConditionalRouter(sourceId, definition, sourceType),
            pathMap as any,
          );
          conditionals.add(sourceId);
        }
        continue;
      }

      for (const edge of edges) {
        const targetNode = definition.nodes.find((n) => n.id === edge.target);
        const targetType = targetNode?.data?.nodeType || targetNode?.type;
        if (!targetNode || targetType === 'note') continue;
        builder.addEdge(sourceId as any, edge.target as any);
      }
    }

    const startNode = definition.nodes.find(
      (n) => (n.data?.nodeType || n.type) === 'start',
    );
    if (startNode) builder.addEdge(START, startNode.id as any);

    for (const node of definition.nodes) {
      const nodeType = node.data?.nodeType || node.type;
      if (nodeType === 'end') builder.addEdge(node.id as any, END);
    }

    return builder.compile({ checkpointer: saver });
  }

  private createNodeFn(
    node: WorkflowNode,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _checkpointer?: BaseCheckpointSaver,
    workflowId?: string,
    threadId?: string,
  ) {
    const nodeType = node.data?.nodeType || node.type;

    // Subworkflow is handled here to avoid a circular dep between
    // LangGraphService ↔ NodeExecutorService.
    if (nodeType === 'subworkflow') {
      return async (state: typeof WorkflowStateAnnotation.State) => {
        const workflowId = node.data?.workflowId as string | undefined;
        if (!workflowId) throw new Error('Subworkflow node is missing workflowId');

        const [wf] = await this.db
          .select()
          .from(workflows)
          .where(eq(workflows.id, workflowId))
          .limit(1);
        if (!wf) throw new Error(`Subworkflow ${workflowId} not found`);

        const subDef = wf.definition as unknown as WorkflowDefinition;
        const subThreadId = `sub:${workflowId}:${randomBytes(8).toString('hex')}`;

        onNodeUpdate(node.id, 'running');

        let subOutput: unknown = null;
        const gen = this.stream(
          subDef,
          state.variables as Record<string, unknown>,
          () => {},
          subThreadId,
          workspaceId,
          new MemorySaver(),
        );
        for await (const s of gen) {
          subOutput = (s as any)?.variables?.lastOutput ?? null;
        }

        const nodeKey = (node.data?.nodeName as string) || (node.data?.name as string) || node.id;
        onNodeUpdate(node.id, 'completed', subOutput);

        return {
          variables: { lastOutput: subOutput, [nodeKey]: subOutput, [node.id]: subOutput },
          chatHistory: [],
          memory: {},
          currentNodeId: node.id,
          nodeResults: {
            [node.id]: { nodeId: node.id, status: 'completed', output: subOutput, completedAt: new Date().toISOString() },
          },
          pendingAuth: null,
          cumulativeUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        };
      };
    }

    return async (state: typeof WorkflowStateAnnotation.State) => {
      // Fast-forward: if this node was pre-loaded from a replay, skip re-execution
      const preloaded = state.nodeResults?.[node.id];
      if (preloaded?.__preloaded) {
        onNodeUpdate(node.id, 'completed', preloaded.output);
        const nodeKey = node.data?.nodeName || node.data?.name || node.id;
        return {
          variables: { lastOutput: preloaded.output, [nodeKey]: preloaded.output, [node.id]: preloaded.output },
          chatHistory: [],
          memory: {},
          currentNodeId: node.id,
          nodeResults: { [node.id]: preloaded },
          pendingAuth: null,
          cumulativeUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        };
      }

      onNodeUpdate(node.id, 'running');

      const workflowState: WorkflowState = {
        variables: state.variables,
        chatHistory: state.chatHistory,
        memory: state.memory,
        nodeResults: state.nodeResults,
        pendingAuth: state.pendingAuth,
        loopResults: state.loopResults,
        cumulativeUsage: state.cumulativeUsage,
      };

      try {
        // Inject nodeId so the agent executor can tag interrupts correctly
        const nodeData = { ...node.data, _nodeId: node.id };

        const { result, isAgentOutput } = await this.nodeExecutor.execute({
          nodeId: node.id,
          nodeType,
          nodeData,
          state: workflowState,
          workspaceId,
          workflowId,
          threadId,
        });

        // Approval gate node (non-agent)
        if (
          result &&
          typeof result === 'object' &&
          '__pendingApproval' in result
        ) {
          onNodeUpdate(node.id, 'suspended', result);
          interrupt({
            type: 'approval',
            nodeId: node.id,
            message: result.message,
          });
        }

        let actualOutput = result;
        let chatUpdates: any[] = [];
        let variableUpdates: Record<string, any> = {};
        let memoryUpdates: Record<string, any> = {};
        let usageUpdate = {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        };
        let toolCallLog: any[] = [];

        if (isAgentOutput && result && '__agentValue' in result) {
          actualOutput = result.__agentValue;
          chatUpdates = result.__chatHistoryUpdates || [];
          variableUpdates = result.__variableUpdates || {};
          memoryUpdates = result.__memoryUpdates || {};
          toolCallLog = result.__toolCallLog || [];
          if (result.__usage) usageUpdate = result.__usage;
        }

        const nodeKey = node.data?.nodeName || node.data?.name || node.id;
        onNodeUpdate(node.id, 'completed', actualOutput);

        return {
          variables: {
            lastOutput: actualOutput,
            [nodeKey]: actualOutput,
            [node.id]: actualOutput,
            ...variableUpdates,
          },
          chatHistory: chatUpdates,
          memory: memoryUpdates,
          currentNodeId: node.id,
          nodeResults: {
            [node.id]: {
              nodeId: node.id,
              status: 'completed',
              output: actualOutput,
              toolCallLog,
              completedAt: new Date().toISOString(),
            },
          },
          pendingAuth: null,
          cumulativeUsage: usageUpdate,
        };
      } catch (error) {
        // Let LangGraph's runner handle interrupts — don't log them as failures
        if (isGraphInterrupt(error)) throw error;
        const msg = error instanceof Error ? error.message : String(error);
        onNodeUpdate(node.id, 'failed', undefined, msg);
        throw error;
      }
    };
  }

  private createConditionalRouter(
    nodeId: string,
    definition: WorkflowDefinition,
    nodeType: string,
  ) {
    return (state: typeof WorkflowStateAnnotation.State) => {
      const node = definition.nodes.find((n) => n.id === nodeId);
      if (!node) return 'default';

      const wfState: WorkflowState = {
        variables: state.variables,
        chatHistory: state.chatHistory,
        nodeResults: state.nodeResults,
        pendingAuth: state.pendingAuth,
        loopResults: state.loopResults || [],
      };

      const result = state.nodeResults?.[nodeId];
      if (!result) return 'else';

      const output = result.output;
      if (nodeType === 'router') return output?.branch ?? 'none';
      return output?.branch ?? 'else';
    };
  }

  async *stream(
    definition: WorkflowDefinition,
    input: Record<string, any>,
    onNodeUpdate: NodeUpdateCallback,
    threadId: string,
    workspaceId: string,
    checkpointer?: BaseCheckpointSaver,
    initialMemory?: Record<string, any>,
    workflowId?: string,
    preloadedState?: { variables: Record<string, any>; nodeResults: Record<string, any> },
  ): AsyncGenerator<typeof WorkflowStateAnnotation.State> {
    const graph = this.buildGraph(
      definition,
      onNodeUpdate,
      workspaceId,
      checkpointer,
      workflowId,
      threadId,
    );
    const config = { configurable: { thread_id: threadId } };

    const initialState = {
      variables: preloadedState?.variables ?? { input, lastOutput: '' },
      chatHistory: [],
      currentNodeId: '',
      nodeResults: preloadedState?.nodeResults ?? {},
      pendingAuth: null,
      memory: initialMemory ?? {},
    };

    const raw = await graph.stream(initialState, {
      ...config,
      streamMode: 'values' as const,
      recursionLimit: 50,
    });

    let latestState: any = initialState;

    for await (const chunk of raw) {
      latestState = chunk;
      yield chunk;
    }

    // After stream ends, detect suspension via checkpointed interrupt tasks.
    // Each interrupt item has shape { value, resumable, ns, when } — we only need .value.
    const snapshot = await graph.getState(config);
    const interruptedTask = (snapshot.tasks as any[]).find(
      (t) => t.interrupts?.length > 0,
    );
    if (interruptedTask) {
      const item = interruptedTask.interrupts[0];
      yield { ...latestState, pendingInterrupt: item?.value ?? item };
    }
  }

  resumeFromApproval(
    definition: WorkflowDefinition,
    threadId: string,
    resumeValue: any,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    checkpointer: BaseCheckpointSaver,
    workflowId?: string,
  ) {
    return this.resumeStream(
      definition,
      threadId,
      resumeValue,
      onNodeUpdate,
      workspaceId,
      checkpointer,
      workflowId,
    );
  }

  private async *resumeStream(
    definition: WorkflowDefinition,
    threadId: string,
    resumeValue: any,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    checkpointer: BaseCheckpointSaver,
    workflowId?: string,
  ): AsyncGenerator<typeof WorkflowStateAnnotation.State> {
    const graph = this.buildGraph(
      definition,
      onNodeUpdate,
      workspaceId,
      checkpointer,
      workflowId,
      threadId,
    );
    const config = { configurable: { thread_id: threadId } };
    const command = new Command({ resume: resumeValue });

    const raw = await graph.stream(command, {
      ...config,
      streamMode: 'values' as const,
      recursionLimit: 50,
    });

    let latestState: any = {};

    for await (const chunk of raw) {
      latestState = chunk;
      yield chunk;
    }

    // After stream ends, detect another suspension (chained interrupts)
    const snapshot = await graph.getState(config);
    const interruptedTask = (snapshot.tasks as any[]).find(
      (t) => t.interrupts?.length > 0,
    );
    if (interruptedTask) {
      const item = interruptedTask.interrupts[0];
      yield { ...latestState, pendingInterrupt: item?.value ?? item };
    }
  }
}
