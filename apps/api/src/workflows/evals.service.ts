import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import type { DrizzleDB } from '@linea/db';
import { executions, evalRuns } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';
import { ConfigService } from '@nestjs/config';

export type AssertionSource =
  | 'output'
  | `node:${string}`
  | 'duration_ms'
  | 'total_tokens'
  | 'input_tokens'
  | 'output_tokens'
  | `tool_calls:${string}`
  | 'tool_calls';

export type Operator =
  | 'equals'
  | 'contains'
  | 'exists'
  | 'not_exists'
  | 'gt'
  | 'lt'
  | 'llm_judge'
  | 'tool_called'
  | 'tool_not_called'
  | 'semantic_match';

export interface Assertion {
  source?: AssertionSource;
  path: string;
  operator: Operator;
  expected?: unknown;
  rubric?: string;
  reference?: string;
  threshold?: number;
}

export interface ScriptedResponse {
  type: 'answer' | 'approve' | 'deny';
  value?: string;
}

export interface TestCase {
  id: string;
  name: string;
  input: Record<string, unknown>;
  assertions: Assertion[];
  trials?: number;
  scriptedResponses?: ScriptedResponse[];
}

export interface AssertionResult {
  source?: string;
  path: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  score?: number;
  reasoning?: string;
}

export interface TrialResult {
  executionId: string;
  status: string;
  passed: boolean;
  assertions: AssertionResult[];
  error?: string;
}

export interface TestCaseResult {
  caseId: string;
  name: string;
  passed: boolean;
  passRate: number;
  assertions: AssertionResult[];
  executionId: string;
  status: string;
  error?: string;
  trialResults?: TrialResult[];
}

export interface EvalRunSummary {
  id: string;
  workflowId: string;
  passCount: number;
  totalCount: number;
  createdAt: string;
  results: TestCaseResult[];
}

/* ------------------------------------------------------------------ */
/*  Terminal row type (Drizzle infers this from the executions table)   */
/* ------------------------------------------------------------------ */
type TerminalRow = Awaited<ReturnType<EvalsService['pollUntilDone']>>;

/* ------------------------------------------------------------------ */
/*  Path extraction                                                     */
/* ------------------------------------------------------------------ */
function getByPath(obj: unknown, path: string): unknown {
  if (!path || path === '.') return obj;
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

/* ------------------------------------------------------------------ */
/*  Source extraction                                                   */
/* ------------------------------------------------------------------ */
function extractSource(terminal: TerminalRow, source: string | undefined): unknown {
  const s = source ?? 'output';

  if (s === 'output') {
    const out = terminal.output as { result?: unknown } | null;
    return out?.result ?? (terminal.variables as Record<string, unknown>)?.lastOutput;
  }

  if (s.startsWith('node:')) {
    const nodeId = s.slice(5);
    return (terminal.nodeResults as Record<string, { output?: unknown }>)?.[nodeId]?.output;
  }

  if (s === 'duration_ms') {
    if (terminal.startedAt && terminal.finishedAt) {
      return terminal.finishedAt.getTime() - terminal.startedAt.getTime();
    }
    return Object.values(
      (terminal.nodeResults as Record<string, { durationMs?: number }>) ?? {},
    ).reduce((sum, nr) => sum + (nr.durationMs ?? 0), 0);
  }

  const tokenUsage = terminal.tokenUsage as { input?: number; output?: number; total?: number } | null;
  if (s === 'total_tokens') return tokenUsage?.total ?? null;
  if (s === 'input_tokens') return tokenUsage?.input ?? null;
  if (s === 'output_tokens') return tokenUsage?.output ?? null;

  type ToolEntry = { step: number; name: string; args: Record<string, unknown>; result: unknown };
  const nodeResultsMap = (terminal.nodeResults as Record<string, { toolCallLog?: ToolEntry[] }>) ?? {};

  if (s === 'tool_calls') {
    return Object.values(nodeResultsMap).flatMap((nr) => nr.toolCallLog ?? []);
  }
  if (s.startsWith('tool_calls:')) {
    const nodeId = s.slice(11);
    return nodeResultsMap[nodeId]?.toolCallLog ?? [];
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Deterministic evaluator                                             */
/* ------------------------------------------------------------------ */
function evaluateDeterministic(assertion: Assertion, extracted: unknown, source: string): AssertionResult {
  const actual = getByPath(extracted, assertion.path);
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

  return { source, path: assertion.path, operator: assertion.operator, expected: assertion.expected, actual, passed };
}

/* ------------------------------------------------------------------ */
/*  Tool call evaluator                                                 */
/* ------------------------------------------------------------------ */
function evaluateToolCalls(assertion: Assertion, extracted: unknown, source: string): AssertionResult {
  type ToolEntry = { name: string };
  const log: ToolEntry[] = Array.isArray(extracted) ? (extracted as ToolEntry[]) : [];
  const toolName = typeof assertion.expected === 'string' ? assertion.expected : '';
  const wasCalled = log.some((entry) => entry.name === toolName);
  const passed = assertion.operator === 'tool_called' ? wasCalled : !wasCalled;

  return {
    source,
    path: assertion.path,
    operator: assertion.operator,
    expected: toolName,
    actual: log.map((e) => e.name),
    passed,
  };
}

/* ------------------------------------------------------------------ */
/*  LLM-as-judge evaluator                                             */
/* ------------------------------------------------------------------ */
async function evaluateWithLlmJudge(
  assertion: Assertion,
  extracted: unknown,
  anthropic: Anthropic,
  source: string,
): Promise<AssertionResult> {
  const actual = getByPath(extracted, assertion.path);
  const threshold = assertion.threshold ?? 0.7;
  const rubric = assertion.rubric ?? 'Does the output meet quality standards?';

  const prompt = `You are an impartial evaluator. Score the following output against the rubric.

Rubric: ${rubric}

Output to evaluate:
${JSON.stringify(actual, null, 2)}

Respond with a JSON object: { "score": <number 0.0-1.0>, "reasoning": "<one sentence>" }
A score >= ${threshold} means PASS.`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content.find((c) => c.type === 'text')?.text ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { score?: number; reasoning?: string }) : {};
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;

    return {
      source,
      path: assertion.path,
      operator: 'llm_judge',
      expected: assertion.rubric,
      actual,
      passed: score >= threshold,
      score,
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return {
      source,
      path: assertion.path,
      operator: 'llm_judge',
      expected: assertion.rubric,
      actual,
      passed: false,
      score: 0,
      reasoning: 'LLM judge call failed',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Semantic match evaluator                                            */
/* ------------------------------------------------------------------ */
async function evaluateSemanticMatch(
  assertion: Assertion,
  extracted: unknown,
  anthropic: Anthropic,
  source: string,
): Promise<AssertionResult> {
  const actual = getByPath(extracted, assertion.path);
  const threshold = assertion.threshold ?? 0.7;
  const reference =
    assertion.reference ??
    (typeof assertion.expected === 'string' ? assertion.expected : '');

  const prompt = `You are an impartial evaluator scoring semantic similarity.

Reference answer:
${reference}

Actual output:
${JSON.stringify(actual, null, 2)}

Score how semantically similar the actual output is to the reference answer, focusing on meaning rather than exact wording.

Respond with a JSON object: { "score": <number 0.0-1.0>, "reasoning": "<one sentence>" }
A score >= ${threshold} means PASS.`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content.find((c) => c.type === 'text')?.text ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { score?: number; reasoning?: string }) : {};
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;

    return {
      source,
      path: assertion.path,
      operator: 'semantic_match',
      expected: reference,
      actual,
      passed: score >= threshold,
      score,
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return {
      source,
      path: assertion.path,
      operator: 'semantic_match',
      expected: reference,
      actual,
      passed: false,
      score: 0,
      reasoning: 'Semantic match LLM call failed',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Service                                                             */
/* ------------------------------------------------------------------ */
@Injectable()
export class EvalsService {
  private readonly anthropic: Anthropic;

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly executionsService: ExecutionsService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async runTestCases(
    podId: string,
    workspaceId: string,
    workflowId: string,
    testCases: TestCase[],
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (const tc of testCases) {
      const k = Math.min(Math.max(tc.trials ?? 1, 1), 5);
      const trialResults: TrialResult[] = [];

      for (let t = 0; t < k; t++) {
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

          const terminal = await this.pollUntilDone(podId, executionId, 120_000, tc.scriptedResponses);
          const assertionResults = await this.evaluateAll(tc.assertions, terminal);
          const trialPassed = assertionResults.every((r) => r.passed) && terminal.status === 'completed';

          trialResults.push({
            executionId,
            status: terminal.status,
            passed: trialPassed,
            assertions: assertionResults,
          });
        } catch (err) {
          trialResults.push({
            executionId,
            status: 'failed',
            passed: false,
            assertions: [],
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const passCount = trialResults.filter((r) => r.passed).length;
      const passRate = passCount / k;
      const passed = passCount > 0;
      const displayTrial = trialResults.find((r) => r.passed) ?? trialResults[trialResults.length - 1];

      results.push({
        caseId: tc.id,
        name: tc.name,
        passed,
        passRate,
        assertions: displayTrial?.assertions ?? [],
        executionId: displayTrial?.executionId ?? '',
        status: displayTrial?.status ?? 'failed',
        error: displayTrial?.error,
        trialResults: k > 1 ? trialResults : undefined,
      });
    }

    const passCount = results.filter((r) => r.passed).length;
    await this.db.insert(evalRuns).values({
      workflowId,
      podId,
      workspaceId,
      results: results as unknown as Record<string, unknown>[],
      passCount,
      totalCount: results.length,
    });

    return results;
  }

  async getRunHistory(workflowId: string, podId: string, limit = 20): Promise<EvalRunSummary[]> {
    const rows = await this.db
      .select()
      .from(evalRuns)
      .where(and(eq(evalRuns.workflowId, workflowId), eq(evalRuns.podId, podId)))
      .orderBy(desc(evalRuns.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      workflowId: r.workflowId,
      passCount: r.passCount,
      totalCount: r.totalCount,
      createdAt: r.createdAt.toISOString(),
      results: r.results as unknown as TestCaseResult[],
    }));
  }

  private async evaluateAll(assertions: Assertion[], terminal: TerminalRow): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];
    for (const a of assertions) {
      const source = a.source ?? 'output';
      const extracted = extractSource(terminal, source);

      if (a.operator === 'tool_called' || a.operator === 'tool_not_called') {
        results.push(evaluateToolCalls(a, extracted, source));
      } else if (a.operator === 'semantic_match') {
        results.push(await evaluateSemanticMatch(a, extracted, this.anthropic, source));
      } else if (a.operator === 'llm_judge') {
        results.push(await evaluateWithLlmJudge(a, extracted, this.anthropic, source));
      } else {
        results.push(evaluateDeterministic(a, extracted, source));
      }
    }
    return results;
  }

  async pollUntilDone(
    podId: string,
    executionId: string,
    timeoutMs: number,
    scriptedResponses?: ScriptedResponse[],
  ) {
    const deadline = Date.now() + timeoutMs;
    const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
    const responseQueue = [...(scriptedResponses ?? [])];

    while (Date.now() < deadline) {
      const [row] = await this.db
        .select()
        .from(executions)
        .where(and(eq(executions.id, executionId), eq(executions.podId, podId)))
        .limit(1);

      if (!row) throw new Error(`Execution ${executionId} not found`);
      if (TERMINAL.has(row.status)) return row;

      if (row.status === 'suspended') {
        const scripted = responseQueue.shift();
        if (!scripted) {
          throw new Error(
            `Execution suspended waiting for input but no scripted response configured`,
          );
        }
        await this.executionsService.respond(podId, executionId, {
          approved:
            scripted.type === 'approve'
              ? true
              : scripted.type === 'deny'
              ? false
              : undefined,
          answer: scripted.type === 'answer' ? (scripted.value ?? '') : undefined,
          comment: scripted.value,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Execution ${executionId} did not complete within ${timeoutMs / 1000}s`);
  }
}
