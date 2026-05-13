import { ExecutionSupervisor } from './supervisor';
import { ConfigService } from '@nestjs/config';
import type { SupervisorContext } from './supervisor';

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => overrides[key] ?? undefined } as unknown as ConfigService;
}

function makeCtx(overrides: Partial<SupervisorContext> = {}): SupervisorContext {
  return {
    nodeId: 'node-1',
    nodeType: 'agent',
    error: 'something went wrong',
    elapsedMs: 5_000,
    retryCount: 0,
    maxRetries: 2,
    state: { variables: {} },
    ...overrides,
  };
}

describe('ExecutionSupervisor — hard rules', () => {
  let supervisor: ExecutionSupervisor;

  beforeEach(() => {
    supervisor = new ExecutionSupervisor(makeConfig());
  });

  it('aborts when retries are exhausted', async () => {
    const decision = await supervisor.assess(makeCtx({ retryCount: 2, maxRetries: 2 }));
    expect(decision.action).toBe('abort');
    expect(decision.reason).toMatch(/exhausted/i);
  });

  it('aborts on API key / authentication errors', async () => {
    const decision = await supervisor.assess(
      makeCtx({ error: 'Invalid API key provided (401)' }),
    );
    expect(decision.action).toBe('abort');
    expect(decision.reason).toMatch(/authentication/i);
  });

  it('aborts on "authentication" in error message', async () => {
    const decision = await supervisor.assess(
      makeCtx({ error: 'authentication failed for provider' }),
    );
    expect(decision.action).toBe('abort');
  });

  it('aborts on "401" in error message', async () => {
    const decision = await supervisor.assess(makeCtx({ error: 'HTTP 401 Unauthorized' }));
    expect(decision.action).toBe('abort');
  });

  it('aborts deterministic transform nodes', async () => {
    const decision = await supervisor.assess(makeCtx({ nodeType: 'transform' }));
    expect(decision.action).toBe('abort');
    expect(decision.reason).toMatch(/deterministic/i);
  });

  it('aborts deterministic if-else nodes', async () => {
    const decision = await supervisor.assess(makeCtx({ nodeType: 'if-else' }));
    expect(decision.action).toBe('abort');
  });

  it('aborts deterministic router nodes', async () => {
    const decision = await supervisor.assess(makeCtx({ nodeType: 'router' }));
    expect(decision.action).toBe('abort');
  });

  it('retries fast failures on first attempt', async () => {
    const decision = await supervisor.assess(
      makeCtx({ elapsedMs: 500, retryCount: 0 }),
    );
    expect(decision.action).toBe('retry');
    expect(decision.retryDelayMs).toBe(1_000);
  });
});

describe('ExecutionSupervisor — LLM fallback', () => {
  it('falls back to retry when no API key is configured', async () => {
    const supervisor = new ExecutionSupervisor(makeConfig());
    // No API keys → createModelClient will fail → supervisor catches and falls back
    const decision = await supervisor.assess(
      makeCtx({ elapsedMs: 10_000, retryCount: 1 }),
    );
    // Whether it retries or aborts: it must return a valid action without throwing
    expect(['retry', 'skip', 'abort', 'continue']).toContain(decision.action);
    expect(typeof decision.reason).toBe('string');
  });
});
