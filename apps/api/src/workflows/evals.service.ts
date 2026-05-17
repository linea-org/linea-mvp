import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { executions } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';

export interface Assertion {
  path: string;
  operator: 'equals' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt';
  expected?: unknown;
}

export interface TestCase {
  id: string;
  name: string;
  input: Record<string, unknown>;
  assertions: Assertion[];
}

export interface AssertionResult {
  path: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface TestCaseResult {
  caseId: string;
  name: string;
  passed: boolean;
  assertions: AssertionResult[];
  executionId: string;
  status: string;
  error?: string;
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path || path === '.') return obj;
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

function evaluate(assertion: Assertion, output: unknown): AssertionResult {
  const actual = getByPath(output, assertion.path);
  let passed = false;

  switch (assertion.operator) {
    case 'equals':
      passed = JSON.stringify(actual) === JSON.stringify(assertion.expected);
      break;
    case 'contains':
      if (typeof actual === 'string' && typeof assertion.expected === 'string') {
        passed = actual.includes(assertion.expected);
      } else if (Array.isArray(actual)) {
        passed = actual.some((v) => JSON.stringify(v) === JSON.stringify(assertion.expected));
      }
      break;
    case 'exists':
      passed = actual !== undefined && actual !== null;
      break;
    case 'not_exists':
      passed = actual === undefined || actual === null;
      break;
    case 'gt':
      passed = typeof actual === 'number' && typeof assertion.expected === 'number' && actual > assertion.expected;
      break;
    case 'lt':
      passed = typeof actual === 'number' && typeof assertion.expected === 'number' && actual < assertion.expected;
      break;
  }

  return { path: assertion.path, operator: assertion.operator, expected: assertion.expected, actual, passed };
}

@Injectable()
export class EvalsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly executionsService: ExecutionsService,
  ) {}

  async runTestCases(
    podId: string,
    workspaceId: string,
    workflowId: string,
    testCases: TestCase[],
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (const tc of testCases) {
      let executionId = '';
      try {
        const ex = await this.executionsService.createFromTrigger(
          podId,
          workspaceId,
          workflowId,
          'manual',
          tc.input,
        );
        executionId = ex.id;

        // Poll until terminal state (max 120s)
        const terminal = await this.pollUntilDone(podId, executionId, 120_000);

        const output = (terminal.output ?? (terminal.variables as Record<string, unknown>)?.lastOutput) as unknown;
        const assertionResults = tc.assertions.map((a) => evaluate(a, output));
        const allPassed = assertionResults.every((r) => r.passed);

        results.push({
          caseId: tc.id,
          name: tc.name,
          passed: allPassed && terminal.status === 'completed',
          assertions: assertionResults,
          executionId,
          status: terminal.status,
        });
      } catch (err) {
        results.push({
          caseId: tc.id,
          name: tc.name,
          passed: false,
          assertions: [],
          executionId,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  private async pollUntilDone(podId: string, executionId: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

    while (Date.now() < deadline) {
      const [row] = await this.db
        .select()
        .from(executions)
        .where(and(eq(executions.id, executionId), eq(executions.podId, podId)))
        .limit(1);

      if (row && TERMINAL.has(row.status)) return row;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Execution ${executionId} did not complete within ${timeoutMs / 1000}s`);
  }
}
