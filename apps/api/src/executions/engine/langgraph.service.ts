import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly nodeExecutor: NodeExecutorService) {}

  buildGraph(
    definition: WorkflowDefinition,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    checkpointer?: MemorySaver,
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
        this.createNodeFn(node, onNodeUpdate, workspaceId),
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
  ) {
    return async (state: typeof WorkflowStateAnnotation.State) => {
      const nodeType = node.data?.nodeType || node.type;
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
    checkpointer?: MemorySaver,
    initialMemory?: Record<string, any>,
  ): AsyncGenerator<typeof WorkflowStateAnnotation.State> {
    const graph = this.buildGraph(
      definition,
      onNodeUpdate,
      workspaceId,
      checkpointer,
    );
    const config = { configurable: { thread_id: threadId } };

    const initialState = {
      variables: { input, lastOutput: '' },
      chatHistory: [],
      currentNodeId: '',
      nodeResults: {},
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
    checkpointer: MemorySaver,
  ) {
    return this.resumeStream(
      definition,
      threadId,
      resumeValue,
      onNodeUpdate,
      workspaceId,
      checkpointer,
    );
  }

  private async *resumeStream(
    definition: WorkflowDefinition,
    threadId: string,
    resumeValue: any,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    checkpointer: MemorySaver,
  ): AsyncGenerator<typeof WorkflowStateAnnotation.State> {
    const graph = this.buildGraph(
      definition,
      onNodeUpdate,
      workspaceId,
      checkpointer,
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
