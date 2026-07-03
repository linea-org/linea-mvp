import type { EvalOperator, EvalTestCase } from './workflow-builder.types';

export type Operator = EvalOperator;
export type TestCase = EvalTestCase;
export type Assertion = TestCase['assertions'][number];
export type ScriptedResponse = NonNullable<TestCase['scriptedResponses']>[number];
export type SourceCategory = 'output' | 'node' | 'metric' | 'tool_calls';

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

export interface WorkflowNodeMeta {
  id: string;
  type: string;
  label: string;
}
