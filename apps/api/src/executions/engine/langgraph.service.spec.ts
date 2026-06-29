import { LangGraphService, MAX_LOOP_TIMEOUT_MS } from './langgraph.service';
import type { WorkflowDefinition, NodeUpdateCallback } from './langgraph.service';

function makeService() {
  const nodeExecutor = {
    execute: jest.fn().mockResolvedValue({ result: 'child-result', isAgentOutput: false }),
  } as any;
  const db = {} as any;
  return new LangGraphService(nodeExecutor, db);
}

function makeLoopDefinition(children: string[]): WorkflowDefinition {
  return {
    nodes: [
      { id: 'loop-1', type: 'loop', data: { nodeType: 'loop', arrayPath: 'items', children }, position: { x: 0, y: 0 } },
      ...children.map((id) => ({
        id,
        type: 'transform',
        data: { nodeType: 'transform', expression: 'item' },
        position: { x: 0, y: 0 },
      })),
    ],
    edges: [],
  };
}

function makeState(items: unknown[]) {
  return {
    variables: { items, input: '', lastOutput: '' },
    chatHistory: [],
    memory: {},
    currentNodeId: '',
    nodeResults: {},
    pendingAuth: null,
    loopResults: [],
    cumulativeUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  };
}

const noop: NodeUpdateCallback = () => {};

describe('LangGraphService — loop timeout (LIN-30)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('throws with correct message when wall-clock time exceeds MAX_LOOP_TIMEOUT_MS', async () => {
    const service = makeService();
    const definition = makeLoopDefinition(['child-1']);

    let callCount = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      // First call sets loopStart; subsequent calls are checked inside the loop.
      // Return a value past the threshold on the second call onward.
      return callCount++ === 0 ? 0 : MAX_LOOP_TIMEOUT_MS + 1;
    });

    const nodeFn = (service as any).createNodeFn(
      definition.nodes[0],
      definition,
      noop,
      'ws-1',
      undefined,
      'wf-1',
      'thread-1',
      undefined,
      undefined,
    );

    await expect(nodeFn(makeState([1, 2, 3]))).rejects.toThrow(
      /Loop exceeded maximum duration of 5 minutes after 0 iterations/,
    );
  });

  it('accumulates token usage from agent child nodes across iterations', async () => {
    const service = makeService();
    const definition = makeLoopDefinition(['child-1']);

    (service as any).nodeExecutor.execute.mockResolvedValue({
      result: { __agentValue: 'reply', __usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } },
      isAgentOutput: true,
    });

    const nodeFn = (service as any).createNodeFn(
      definition.nodes[0],
      definition,
      noop,
      'ws-1',
      undefined,
      'wf-1',
      'thread-1',
      undefined,
      undefined,
    );

    const result = await nodeFn(makeState([1, 2]));
    // 2 iterations × 1 child × { input: 10, output: 5, total: 15 }
    expect(result.cumulativeUsage).toEqual({ input_tokens: 20, output_tokens: 10, total_tokens: 30 });
  });
});
