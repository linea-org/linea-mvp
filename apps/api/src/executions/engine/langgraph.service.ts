import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
  Command,
  isGraphInterrupt,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { workflows } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';
import { NodeExecutorService } from './node-executor.service';
import type { WorkflowState } from './variable-substitution';
import { executeLoopNode } from './executors/loop.executor';
import type { LoopNodeData } from './executors/loop.executor';

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
  settings?: { supervisorModel?: string; [k: string]: unknown };
}

export type NodeUpdateCallback = (
  nodeId: string,
  status: 'running' | 'completed' | 'failed' | 'suspended',
  output?: any,
  error?: string,
  durationMs?: number,
) => void | Promise<void>;

export type AgentTokenCallback = (nodeId: string, delta: string) => void;

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
    onAgentToken?: AgentTokenCallback,
  ) {
    const saver = checkpointer ?? new MemorySaver();
    const builder = new StateGraph(WorkflowStateAnnotation);
    const supervisorModelOverride = definition.settings?.supervisorModel;

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
      if (nodeType === 'note' || nodeType === 'frame') continue;
      builder.addNode(
        node.id,
        this.createNodeFn(
          node,
          definition,
          onNodeUpdate,
          workspaceId,
          checkpointer,
          workflowId,
          threadId,
          supervisorModelOverride,
          onAgentToken,
        ),
      );
    }

    const conditionals = new Set<string>();

    for (const [sourceId, edges] of edgesBySource) {
      const sourceNode = definition.nodes.find((n) => n.id === sourceId);
      const sourceType = sourceNode?.data?.nodeType || sourceNode?.type;
      if (!sourceNode || sourceType === 'note' || sourceType === 'frame')
        continue;

      if (
        sourceType === 'if-else' ||
        sourceType === 'if / else' ||
        sourceType === 'router' ||
        sourceType === 'approval' ||
        sourceType === 'approval-gate' ||
        sourceType === 'evaluator' ||
        sourceType === 'guardrails'
      ) {
        if (!conditionals.has(sourceId)) {
          const pathMap: Record<string, string> = {};
          for (const edge of edges)
            pathMap[edge.sourceHandle || edge.label || 'default'] = edge.target;
          builder.addConditionalEdges(
            sourceId as any,
            this.createConditionalRouter(
              sourceId,
              definition,
              sourceType,
              pathMap,
            ),
            pathMap as any,
          );
          conditionals.add(sourceId);
        }
        continue;
      }

      const loopChildren = sourceType === 'loop'
        ? new Set<string>((sourceNode.data as any)?.children ?? [])
        : null;

      for (const edge of edges) {
        const targetNode = definition.nodes.find((n) => n.id === edge.target);
        const targetType = targetNode?.data?.nodeType || targetNode?.type;
        if (!targetNode || targetType === 'note') continue;
        // Skip graph edges from a loop node to its declared children — those
        // nodes are executed inline by the loop handler; a graph edge would
        // cause them to run a second time outside the loop context.
        if (loopChildren?.has(edge.target)) continue;
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
    definition: WorkflowDefinition,
    onNodeUpdate: NodeUpdateCallback,
    workspaceId: string,
    _checkpointer?: BaseCheckpointSaver,
    workflowId?: string,
    threadId?: string,
    supervisorModelOverride?: string,
    onAgentToken?: AgentTokenCallback,
  ) {
    const nodeType = node.data?.nodeType || node.type;

    if (nodeType === 'loop') {
      return async (state: typeof WorkflowStateAnnotation.State) => {
        const loopData = node.data as LoopNodeData;
        const children = loopData.children ?? [];

        const workflowState: WorkflowState = {
          variables: state.variables,
          chatHistory: state.chatHistory,
          memory: state.memory,
          nodeResults: state.nodeResults,
          pendingAuth: state.pendingAuth,
          loopResults: state.loopResults,
          cumulativeUsage: state.cumulativeUsage,
        };

        onNodeUpdate(node.id, 'running');
        const loopStart = Date.now();

        try {
          const { items, results: transformedItems } = executeLoopNode(loopData, workflowState);

          // If no children are configured, fall through to the regular executor path
          if (children.length === 0) {
            const { result, isAgentOutput } = await this.nodeExecutor.execute({
              nodeId: node.id,
              nodeType,
              nodeData: { ...node.data, _nodeId: node.id },
              state: workflowState,
              workspaceId,
              workflowId,
              threadId,
              supervisorModelOverride,
            });
            const durationMs = Date.now() - loopStart;
            let actualResult = result;
            let usageUpdate = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
            if (isAgentOutput && result) {
              if ('__agentValue' in result) actualResult = result.__agentValue;
              if (result.__usage) usageUpdate = result.__usage as typeof usageUpdate;
            }
            onNodeUpdate(node.id, 'completed', actualResult, undefined, durationMs);
            const nodeKey = node.data?.nodeName || node.data?.name || node.id;
            return {
              variables: { lastOutput: actualResult, [nodeKey]: actualResult, [node.id]: actualResult },
              chatHistory: [],
              memory: {},
              currentNodeId: node.id,
              nodeResults: { [node.id]: { nodeId: node.id, status: 'completed', output: actualResult, completedAt: new Date().toISOString(), durationMs } },
              pendingAuth: null,
              cumulativeUsage: usageUpdate,
            };
          }

          const iterationResults: unknown[] = [];
          let currentVars: Record<string, any> = { ...state.variables };
          const childNodeResults: Record<string, any> = {};
          const totalUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
          const baseChatHistory: Array<{ role: string; content: string }> = [...(state.chatHistory ?? [])];
          let chatHistoryDelta: Array<{ role: string; content: string }> = [];
          let accumulatedMemory: Record<string, any> = { ...(state.memory ?? {}) };

          for (let i = 0; i < transformedItems.length; i++) {
            const item = transformedItems[i];
            currentVars = { ...currentVars, item, loopItem: item, loopIndex: i };

            for (const childId of children) {
              const childNode = definition.nodes.find((n) => n.id === childId);
              if (!childNode) {
                this.logger.warn(`Loop node ${node.id}: child node '${childId}' not found in definition, skipping`);
                continue;
              }
              const childType = childNode.data?.nodeType || childNode.type;

              const childState: WorkflowState = {
                variables: currentVars,
                chatHistory: [...baseChatHistory, ...chatHistoryDelta],
                memory: accumulatedMemory,
                nodeResults: { ...state.nodeResults, ...childNodeResults },
                pendingAuth: state.pendingAuth,
                loopResults: state.loopResults,
                cumulativeUsage: state.cumulativeUsage,
              };

              onNodeUpdate(childNode.id, 'running');
              const childStart = Date.now();
              let childResult: any;
              let isAgentOutput: boolean;
              try {
                ({ result: childResult, isAgentOutput } = await this.nodeExecutor.execute({
                  nodeId: childNode.id,
                  nodeType: childType,
                  nodeData: { ...childNode.data, _nodeId: childNode.id },
                  state: childState,
                  workspaceId,
                  workflowId,
                  threadId,
                  supervisorModelOverride,
                  onToken: onAgentToken ? (delta) => onAgentToken(childNode.id, delta) : undefined,
                }));
              } catch (childError) {
                const childDurationMs = Date.now() - childStart;
                if (isGraphInterrupt(childError)) {
                  onNodeUpdate(childNode.id, 'suspended', undefined, undefined, childDurationMs);
                } else {
                  const msg = childError instanceof Error ? childError.message : String(childError);
                  onNodeUpdate(childNode.id, 'failed', undefined, msg, childDurationMs);
                }
                throw childError;
              }
              const childDurationMs = Date.now() - childStart;

              let actualOutput = childResult;
              let childVariableUpdates: Record<string, any> = {};
              if (isAgentOutput && childResult) {
                if ('__agentValue' in childResult) actualOutput = childResult.__agentValue;
                if (childResult.__variableUpdates) childVariableUpdates = childResult.__variableUpdates;
                if (childResult.__chatHistoryUpdates) chatHistoryDelta = [...chatHistoryDelta, ...childResult.__chatHistoryUpdates];
                if (childResult.__memoryUpdates) accumulatedMemory = { ...accumulatedMemory, ...childResult.__memoryUpdates };
                if (childResult.__usage) {
                  const u = childResult.__usage as { input_tokens?: number; output_tokens?: number; total_tokens?: number };
                  totalUsage.input_tokens += u.input_tokens ?? 0;
                  totalUsage.output_tokens += u.output_tokens ?? 0;
                  totalUsage.total_tokens += u.total_tokens ?? 0;
                }
              }

              onNodeUpdate(childNode.id, 'completed', actualOutput, undefined, childDurationMs);
              childNodeResults[childNode.id] = {
                nodeId: childNode.id,
                status: 'completed',
                output: actualOutput,
                completedAt: new Date().toISOString(),
                durationMs: childDurationMs,
              };

              const childKey = childNode.data?.nodeName || childNode.data?.name || childNode.id;
              currentVars = { ...currentVars, lastOutput: actualOutput, [childKey]: actualOutput, [childNode.id]: actualOutput, ...childVariableUpdates };
            }

            iterationResults.push(currentVars.lastOutput);
          }

          const durationMs = Date.now() - loopStart;
          const output = { results: iterationResults, total: iterationResults.length, items };
          onNodeUpdate(node.id, 'completed', output, undefined, durationMs);

          const nodeKey = node.data?.nodeName || node.data?.name || node.id;
          return {
            variables: { ...currentVars, lastOutput: output, [nodeKey]: output, [node.id]: output },
            chatHistory: chatHistoryDelta,
            memory: accumulatedMemory,
            currentNodeId: node.id,
            nodeResults: {
              ...childNodeResults,
              [node.id]: { nodeId: node.id, status: 'completed', output, completedAt: new Date().toISOString(), durationMs },
            },
            pendingAuth: null,
            loopResults: iterationResults,
            cumulativeUsage: totalUsage,
          };
        } catch (error) {
          if (isGraphInterrupt(error)) throw error;
          const durationMs = Date.now() - loopStart;
          const msg = error instanceof Error ? error.message : String(error);
          onNodeUpdate(node.id, 'failed', undefined, msg, durationMs);
          throw error;
        }
      };
    }

    // Subworkflow is handled here to avoid a circular dep between
    // LangGraphService ↔ NodeExecutorService.
    if (nodeType === 'subworkflow') {
      return async (state: typeof WorkflowStateAnnotation.State) => {
        const workflowId = node.data?.workflowId as string | undefined;
        if (!workflowId)
          throw new Error('Subworkflow node is missing workflowId');

        const [wf] = await this.db
          .select()
          .from(workflows)
          .where(eq(workflows.id, workflowId))
          .limit(1);
        if (!wf) throw new Error(`Subworkflow ${workflowId} not found`);

        const subDef = wf.definition as unknown as WorkflowDefinition;
        const subThreadId = `sub:${workflowId}:${randomBytes(8).toString('hex')}`;

        onNodeUpdate(node.id, 'running');
        const subStart = Date.now();

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

        const subDurationMs = Date.now() - subStart;
        const nodeKey =
          (node.data?.nodeName as string) ||
          (node.data?.name as string) ||
          node.id;
        onNodeUpdate(node.id, 'completed', subOutput, undefined, subDurationMs);

        return {
          variables: {
            lastOutput: subOutput,
            [nodeKey]: subOutput,
            [node.id]: subOutput,
          },
          chatHistory: [],
          memory: {},
          currentNodeId: node.id,
          nodeResults: {
            [node.id]: {
              nodeId: node.id,
              status: 'completed',
              output: subOutput,
              completedAt: new Date().toISOString(),
            },
          },
          pendingAuth: null,
          cumulativeUsage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
        };
      };
    }

    return async (state: typeof WorkflowStateAnnotation.State) => {
      // Fast-forward: if this node was pre-loaded from a replay, skip re-execution
      const preloaded = state.nodeResults?.[node.id];
      if (preloaded?.__preloaded) {
        onNodeUpdate(node.id, 'completed', preloaded.output, undefined, 0);
        const nodeKey = node.data?.nodeName || node.data?.name || node.id;
        return {
          variables: {
            lastOutput: preloaded.output,
            [nodeKey]: preloaded.output,
            [node.id]: preloaded.output,
          },
          chatHistory: [],
          memory: {},
          currentNodeId: node.id,
          nodeResults: { [node.id]: preloaded },
          pendingAuth: null,
          cumulativeUsage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
        };
      }

      onNodeUpdate(node.id, 'running');
      const nodeStart = Date.now();

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
          supervisorModelOverride,
          onToken: onAgentToken
            ? (delta) => onAgentToken(node.id, delta)
            : undefined,
        });

        const durationMs = Date.now() - nodeStart;

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
        onNodeUpdate(node.id, 'completed', actualOutput, undefined, durationMs);

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
              durationMs,
            },
          },
          pendingAuth: null,
          cumulativeUsage: usageUpdate,
        };
      } catch (error) {
        // Let LangGraph's runner handle interrupts — don't log them as failures
        if (isGraphInterrupt(error)) throw error;
        const durationMs = Date.now() - nodeStart;
        const msg = error instanceof Error ? error.message : String(error);
        onNodeUpdate(node.id, 'failed', undefined, msg, durationMs);
        throw error;
      }
    };
  }

  private createConditionalRouter(
    nodeId: string,
    definition: WorkflowDefinition,
    nodeType: string,
    pathMap: Record<string, string>,
  ) {
    return (state: typeof WorkflowStateAnnotation.State) => {
      const node = definition.nodes.find((n) => n.id === nodeId);
      if (!node) return this.resolvePathKey(pathMap, 'default');

      const result = state.nodeResults?.[nodeId];
      if (!result) return this.resolvePathKey(pathMap, 'else');

      const output = result.output;
      let candidate: string;
      if (nodeType === 'router') candidate = output?.branch ?? 'none';
      else if (nodeType === 'approval' || nodeType === 'approval-gate')
        candidate = output?.__approvalDecision ?? 'approved';
      else if (nodeType === 'evaluator')
        candidate = output?.passed === true ? 'passed' : 'failed';
      else if (nodeType === 'guardrails')
        candidate = output?.passed === true ? 'pass' : 'block';
      else candidate = output?.branch ?? 'else';

      return this.resolvePathKey(pathMap, candidate);
    };
  }

  /**
   * Return `preferred` if it exists in pathMap, otherwise fall back to 'default',
   * then to the first available key. This prevents LangGraph from throwing
   * "Branch condition returned unknown or null destination" when a branching node
   * (guardrails, approval, evaluator) has a single un-labelled outgoing edge.
   */
  private resolvePathKey(
    pathMap: Record<string, string>,
    preferred: string,
  ): string {
    if (preferred in pathMap) return preferred;
    if ('default' in pathMap) return 'default';
    const keys = Object.keys(pathMap);
    return keys[0] ?? 'default';
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
    preloadedState?: {
      variables: Record<string, any>;
      nodeResults: Record<string, any>;
    },
    onAgentToken?: AgentTokenCallback,
  ): AsyncGenerator<typeof WorkflowStateAnnotation.State> {
    const graph = this.buildGraph(
      definition,
      onNodeUpdate,
      workspaceId,
      checkpointer,
      workflowId,
      threadId,
      onAgentToken,
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
    onAgentToken?: AgentTokenCallback,
  ) {
    return this.resumeStream(
      definition,
      threadId,
      resumeValue,
      onNodeUpdate,
      workspaceId,
      checkpointer,
      workflowId,
      onAgentToken,
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
    onAgentToken?: AgentTokenCallback,
  ): AsyncGenerator<typeof WorkflowStateAnnotation.State> {
    const graph = this.buildGraph(
      definition,
      onNodeUpdate,
      workspaceId,
      checkpointer,
      workflowId,
      threadId,
      onAgentToken,
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
