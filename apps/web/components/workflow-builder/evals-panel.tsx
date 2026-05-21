'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, Delete01Icon, PlayIcon, Loading01Icon,
  Tick01Icon, Cancel01Icon, TestTube01Icon, Alert02Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@linea/ui/components/select';
import { Textarea } from '@linea/ui/components/textarea';
import { createApiClient } from '@/lib/api';
import { EvalInputForm, type InputVar } from './eval-input-form';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
type AssertionSource =
  | 'output'
  | `node:${string}`
  | 'duration_ms'
  | 'total_tokens'
  | 'input_tokens'
  | 'output_tokens'
  | `tool_calls:${string}`
  | 'tool_calls';

type Operator =
  | 'equals' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt'
  | 'llm_judge' | 'tool_called' | 'tool_not_called' | 'semantic_match';

type SourceCategory = 'output' | 'node' | 'metric' | 'tool_calls';

interface Assertion {
  source?: string;
  path: string;
  operator: Operator;
  expected: string;
  rubric?: string;
  reference?: string;
  threshold?: string;
}

interface ScriptedResponse {
  type: 'answer' | 'approve' | 'deny';
  value: string;
}

interface TestCase {
  id: string;
  name: string;
  input: string;
  assertions: Assertion[];
  trials?: number;
  scriptedResponses?: ScriptedResponse[];
}

interface AssertionResult {
  source?: string;
  path: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  score?: number;
  reasoning?: string;
}

interface TrialResult {
  executionId: string;
  status: string;
  passed: boolean;
  assertions: AssertionResult[];
  error?: string;
}

interface TestCaseResult {
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

interface WorkflowNodeMeta {
  id: string;
  type: string;
  label: string;
}

interface EvalsPanelProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onClose: () => void;
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
  inputVariables?: InputVar[];
  workflowNodes?: WorkflowNodeMeta[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function newCase(): TestCase {
  return {
    id: Math.random().toString(36).slice(2, 9),
    name: 'Eval case',
    input: '{}',
    assertions: [{ source: 'output', path: '', operator: 'exists', expected: '' }],
    trials: 1,
  };
}

function newAssertion(): Assertion {
  return { source: 'output', path: '', operator: 'exists', expected: '' };
}

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'equals',
  contains: 'contains',
  exists: 'exists',
  not_exists: 'not exists',
  gt: 'greater than',
  lt: 'less than',
  llm_judge: 'LLM judge',
  tool_called: 'was called',
  tool_not_called: 'was NOT called',
  semantic_match: 'semantic match',
};

const NEEDS_EXPECTED = new Set<Operator>(['equals', 'contains', 'gt', 'lt']);

function getSourceCategory(source: string | undefined): SourceCategory {
  if (!source || source === 'output') return 'output';
  if (source.startsWith('node:')) return 'node';
  if (source === 'tool_calls' || source.startsWith('tool_calls:')) return 'tool_calls';
  return 'metric';
}

const OPERATORS_FOR_SOURCE: Record<SourceCategory, Operator[]> = {
  output: ['equals', 'contains', 'exists', 'not_exists', 'gt', 'lt', 'llm_judge', 'semantic_match'],
  node: ['equals', 'contains', 'exists', 'not_exists', 'gt', 'lt', 'llm_judge', 'semantic_match'],
  metric: ['equals', 'gt', 'lt'],
  tool_calls: ['tool_called', 'tool_not_called'],
};

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export function EvalsPanel({
  workspaceId, podId, workflowId, token, onClose, testCases, onTestCasesChange, inputVariables, workflowNodes,
}: EvalsPanelProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestCaseResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(testCases[0]?.id ?? null);

  function addCase() {
    const c = newCase();
    onTestCasesChange([...testCases, c]);
    setExpandedCase(c.id);
  }

  function removeCase(id: string) {
    onTestCasesChange(testCases.filter((c) => c.id !== id));
    if (expandedCase === id) setExpandedCase(null);
  }

  function updateCase(id: string, patch: Partial<TestCase>) {
    onTestCasesChange(testCases.map((c) => c.id === id ? { ...c, ...patch } : c));
  }

  function addAssertion(caseId: string) {
    updateCase(caseId, {
      assertions: [
        ...(testCases.find((c) => c.id === caseId)?.assertions ?? []),
        newAssertion(),
      ],
    });
  }

  function updateAssertion(caseId: string, idx: number, patch: Partial<Assertion>) {
    const tc = testCases.find((c) => c.id === caseId);
    if (!tc) return;
    updateCase(caseId, {
      assertions: tc.assertions.map((a, i) => i === idx ? { ...a, ...patch } : a),
    });
  }

  function removeAssertion(caseId: string, idx: number) {
    const tc = testCases.find((c) => c.id === caseId);
    if (!tc) return;
    updateCase(caseId, { assertions: tc.assertions.filter((_, i) => i !== idx) });
  }

  async function runAll() {
    if (testCases.length === 0) return;
    setRunning(true);
    setResults(null);
    setError(null);

    const payload = testCases.map((tc) => {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.input) as Record<string, unknown>; } catch { input = {}; }
      return {
        id: tc.id,
        name: tc.name,
        input,
        trials: tc.trials ?? 1,
        scriptedResponses: tc.scriptedResponses?.filter((r) => r.value.trim() !== '' || r.type !== 'answer'),
        assertions: tc.assertions.map((a) => {
          const base = {
            path: a.path,
            operator: a.operator,
            ...(a.source && a.source !== 'output' ? { source: a.source } : {}),
          };
          if (a.operator === 'llm_judge') {
            return { ...base, rubric: a.rubric || undefined, threshold: a.threshold ? parseFloat(a.threshold) : 0.7 };
          }
          if (a.operator === 'semantic_match') {
            return { ...base, reference: a.reference || undefined, threshold: a.threshold ? parseFloat(a.threshold) : 0.7 };
          }
          if (a.operator === 'tool_called' || a.operator === 'tool_not_called') {
            return { ...base, expected: a.expected };
          }
          if (NEEDS_EXPECTED.has(a.operator)) {
            return { ...base, expected: (() => { try { return JSON.parse(a.expected); } catch { return a.expected; } })() };
          }
          return base;
        }),
      };
    });

    try {
      const api = createApiClient(token);
      const res = await api.post<TestCaseResult[]>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/evals/run`,
        { testCases: payload },
      );
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eval run failed');
    } finally {
      setRunning(false);
    }
  }

  const passCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={TestTube01Icon} className="size-4 text-amber-500" />
          <span className="text-sm font-semibold">Evals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="xs" variant="ghost" onClick={addCase} disabled={running}>
            <HugeiconsIcon icon={Add01Icon} />
            Add case
          </Button>
          <Button
            size="xs"
            onClick={() => void runAll()}
            disabled={running || testCases.length === 0}
          >
            <HugeiconsIcon icon={running ? Loading01Icon : PlayIcon} className={running ? 'animate-spin' : ''} />
            {running ? 'Running…' : 'Run all'}
          </Button>
          <button
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {results && (
        <div className={`shrink-0 px-4 py-2 text-xs font-medium border-b border-border ${passCount === totalCount ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
          {passCount}/{totalCount} eval cases passed
        </div>
      )}

      {error && (
        <div className="shrink-0 px-4 py-2 text-xs text-destructive border-b border-border bg-destructive/5">
          {error}
        </div>
      )}

      {/* Cases list */}
      <div className="flex-1 overflow-y-auto">
        {testCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <HugeiconsIcon icon={TestTube01Icon} className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No eval cases yet.</p>
            <Button size="xs" variant="outline" onClick={addCase}>
              <HugeiconsIcon icon={Add01Icon} />
              Add your first eval case
            </Button>
          </div>
        ) : (
          <div className="space-y-0">
            {testCases.map((tc) => {
              const result = results?.find((r) => r.caseId === tc.id);
              const isExpanded = expandedCase === tc.id;

              return (
                <div key={tc.id} className="border-b border-border">
                  {/* Case header */}
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedCase(isExpanded ? null : tc.id)}
                  >
                    {result ? (
                      <HugeiconsIcon
                        icon={result.passed ? Tick01Icon : Cancel01Icon}
                        className={`size-3.5 shrink-0 ${result.passed ? 'text-green-500' : 'text-destructive'}`}
                      />
                    ) : (
                      <span className="size-3.5 shrink-0 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className="flex-1 text-xs font-medium truncate">{tc.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {result?.trialResults && (
                        <span className="text-[10px] text-muted-foreground">
                          {result.trialResults.filter((t) => t.passed).length}/{result.trialResults.length} trials
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {tc.assertions.length} assertion{tc.assertions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-3 bg-muted/10">
                      {/* Name + delete */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px]">Eval name</Label>
                          <Input
                            value={tc.name}
                            onChange={(e) => updateCase(tc.id, { name: e.target.value })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1 shrink-0">
                          <Label className="text-[10px]">Trials (pass@k)</Label>
                          <Select
                            value={String(tc.trials ?? 1)}
                            onValueChange={(v) => updateCase(tc.id, { trials: parseInt(v, 10) })}
                          >
                            <SelectTrigger className="h-7 w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          size="icon-xs"
                          variant="destructive"
                          className="mt-5 shrink-0"
                          onClick={() => removeCase(tc.id)}
                        >
                          <HugeiconsIcon icon={Delete01Icon} />
                        </Button>
                      </div>

                      {/* Input */}
                      <EvalInputForm
                        inputVariables={inputVariables}
                        value={tc.input}
                        onChange={(json) => updateCase(tc.id, { input: json })}
                      />

                      {/* Scripted responses for interrupt nodes */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px]">Interrupt Responses</Label>
                            <span title="Pre-configured answers for approval/ask_human nodes. Consumed in order when the workflow suspends.">
                              <HugeiconsIcon icon={Alert02Icon} className="size-3 text-muted-foreground/50 cursor-help" />
                            </span>
                          </div>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => updateCase(tc.id, {
                              scriptedResponses: [
                                ...(tc.scriptedResponses ?? []),
                                { type: 'answer', value: '' },
                              ],
                            })}
                          >
                            <HugeiconsIcon icon={Add01Icon} />
                            Add
                          </Button>
                        </div>

                        {(tc.scriptedResponses ?? []).length === 0 ? (
                          <p className="text-[10px] text-muted-foreground/60 text-center py-1">
                            No responses — workflow will fail if it suspends.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {(tc.scriptedResponses ?? []).map((sr, si) => (
                              <div key={si} className="flex items-center gap-1.5">
                                <span className="text-[9px] text-muted-foreground w-4 shrink-0 text-right">{si + 1}.</span>
                                <Select
                                  value={sr.type}
                                  onValueChange={(v) => {
                                    const updated = [...(tc.scriptedResponses ?? [])];
                                    updated[si] = { ...sr, type: v as ScriptedResponse['type'] };
                                    updateCase(tc.id, { scriptedResponses: updated });
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-20 shrink-0 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="answer">Answer</SelectItem>
                                    <SelectItem value="approve">Approve</SelectItem>
                                    <SelectItem value="deny">Deny</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={sr.value}
                                  onChange={(e) => {
                                    const updated = [...(tc.scriptedResponses ?? [])];
                                    updated[si] = { ...sr, value: e.target.value };
                                    updateCase(tc.id, { scriptedResponses: updated });
                                  }}
                                  placeholder={sr.type === 'answer' ? 'Response text…' : 'Comment (optional)'}
                                  className="h-6 text-[11px] flex-1"
                                />
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => {
                                    const updated = (tc.scriptedResponses ?? []).filter((_, i) => i !== si);
                                    updateCase(tc.id, { scriptedResponses: updated });
                                  }}
                                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                                >
                                  <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Assertions */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px]">Assertions</Label>
                          <Button size="xs" variant="ghost" onClick={() => addAssertion(tc.id)}>
                            <HugeiconsIcon icon={Add01Icon} />
                            Add
                          </Button>
                        </div>

                        {tc.assertions.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground text-center py-2">
                            No assertions — case always passes.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {tc.assertions.map((assertion, ai) => {
                              const ar = result?.assertions[ai];
                              const cat = getSourceCategory(assertion.source);
                              const allowedOps = OPERATORS_FOR_SOURCE[cat];
                              const op = assertion.operator;
                              const isJudge = op === 'llm_judge';
                              const isSemanticMatch = op === 'semantic_match';
                              const isToolOp = op === 'tool_called' || op === 'tool_not_called';
                              const showPath = (cat === 'output' || cat === 'node') && !isJudge && !isSemanticMatch && !isToolOp;
                              const agentNodes = workflowNodes?.filter((n) => n.type === 'agent') ?? [];

                              return (
                                <div
                                  key={ai}
                                  className={`rounded-md border p-2 space-y-1.5 ${ar ? (ar.passed ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20') : 'border-border bg-background'}`}
                                >
                                  {/* Header row */}
                                  <div className="flex items-center gap-1.5">
                                    {ar && (
                                      <HugeiconsIcon
                                        icon={ar.passed ? Tick01Icon : Cancel01Icon}
                                        className={`size-3 shrink-0 ${ar.passed ? 'text-green-500' : 'text-destructive'}`}
                                      />
                                    )}
                                    <span className="text-[10px] font-medium text-muted-foreground flex-1">
                                      Assertion {ai + 1}
                                    </span>
                                    {ar?.score !== undefined && (
                                      <span className={`text-[10px] font-mono ${ar.passed ? 'text-green-600' : 'text-destructive'}`}>
                                        score: {ar.score.toFixed(2)}
                                      </span>
                                    )}
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      onClick={() => removeAssertion(tc.id, ai)}
                                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                    >
                                      <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                                    </Button>
                                  </div>

                                  {/* Source selector */}
                                  <div className="space-y-0.5">
                                    <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Evaluate</label>
                                    <Select
                                      value={assertion.source ?? 'output'}
                                      onValueChange={(newSource) => {
                                        const newCat = getSourceCategory(newSource);
                                        const newOps = OPERATORS_FOR_SOURCE[newCat];
                                        const newOp = newOps.includes(op) ? op : newOps[0]!;
                                        updateAssertion(tc.id, ai, { source: newSource, operator: newOp });
                                      }}
                                    >
                                      <SelectTrigger className="h-6 w-full text-[11px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          <SelectLabel>Output</SelectLabel>
                                          <SelectItem value="output">Final output</SelectItem>
                                        </SelectGroup>
                                        {(workflowNodes ?? []).length > 0 && (
                                          <SelectGroup>
                                            <SelectLabel>Nodes</SelectLabel>
                                            {(workflowNodes ?? []).map((n) => (
                                              <SelectItem key={`node:${n.id}`} value={`node:${n.id}`}>
                                                {n.label}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        )}
                                        <SelectGroup>
                                          <SelectLabel>Metrics</SelectLabel>
                                          <SelectItem value="duration_ms">Duration (ms)</SelectItem>
                                          <SelectItem value="total_tokens">Total tokens</SelectItem>
                                          <SelectItem value="input_tokens">Input tokens</SelectItem>
                                          <SelectItem value="output_tokens">Output tokens</SelectItem>
                                        </SelectGroup>
                                        {agentNodes.length > 0 && (
                                          <SelectGroup>
                                            <SelectLabel>Tool calls</SelectLabel>
                                            <SelectItem value="tool_calls">Any agent</SelectItem>
                                            {agentNodes.map((n) => (
                                              <SelectItem key={`tool_calls:${n.id}`} value={`tool_calls:${n.id}`}>
                                                {n.label}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Operator + optional path row */}
                                  <div className={`grid gap-1.5 ${showPath ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {showPath && (
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Path</label>
                                        <Input
                                          value={assertion.path}
                                          onChange={(e) => updateAssertion(tc.id, ai, { path: e.target.value })}
                                          placeholder="e.g. result.score"
                                          className="h-6 text-[11px] font-mono"
                                        />
                                      </div>
                                    )}
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Check</label>
                                      <Select
                                        value={op}
                                        onValueChange={(v) => updateAssertion(tc.id, ai, { operator: v as Operator })}
                                      >
                                        <SelectTrigger className="h-6 w-full text-[11px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {allowedOps.map((o) => (
                                            <SelectItem key={o} value={o}>{OPERATOR_LABELS[o]}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* LLM judge fields */}
                                  {isJudge && (
                                    <div className="space-y-1.5">
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                                          Output path (optional)
                                        </label>
                                        <Input
                                          value={assertion.path}
                                          onChange={(e) => updateAssertion(tc.id, ai, { path: e.target.value })}
                                          placeholder="e.g. result.text (blank = whole output)"
                                          className="h-6 text-[11px] font-mono"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Rubric</label>
                                        <Textarea
                                          value={assertion.rubric}
                                          onChange={(e) => updateAssertion(tc.id, ai, { rubric: e.target.value })}
                                          placeholder="e.g. The response should be polite, concise, and answer the user's question."
                                          className="text-[11px] min-h-[52px] resize-none"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                                          Pass threshold (0–1)
                                        </label>
                                        <Input
                                          value={assertion.threshold}
                                          onChange={(e) => updateAssertion(tc.id, ai, { threshold: e.target.value })}
                                          placeholder="0.7"
                                          className="h-6 text-[11px] font-mono w-20"
                                        />
                                      </div>
                                      {ar?.reasoning && (
                                        <div className={`rounded px-2 py-1 text-[10px] ${ar.passed ? 'bg-green-50/80 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                                          {ar.reasoning}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Semantic match fields */}
                                  {isSemanticMatch && (
                                    <div className="space-y-1.5">
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                                          Output path (optional)
                                        </label>
                                        <Input
                                          value={assertion.path}
                                          onChange={(e) => updateAssertion(tc.id, ai, { path: e.target.value })}
                                          placeholder="e.g. result.text (blank = whole output)"
                                          className="h-6 text-[11px] font-mono"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Reference answer</label>
                                        <Textarea
                                          value={assertion.reference ?? ''}
                                          onChange={(e) => updateAssertion(tc.id, ai, { reference: e.target.value })}
                                          placeholder="The ideal/expected answer to compare against…"
                                          className="text-[11px] min-h-[52px] resize-none"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                                          Pass threshold (0–1)
                                        </label>
                                        <Input
                                          value={assertion.threshold}
                                          onChange={(e) => updateAssertion(tc.id, ai, { threshold: e.target.value })}
                                          placeholder="0.7"
                                          className="h-6 text-[11px] font-mono w-20"
                                        />
                                      </div>
                                      {ar?.reasoning && (
                                        <div className={`rounded px-2 py-1 text-[10px] ${ar.passed ? 'bg-green-50/80 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                                          {ar.reasoning}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Tool call fields */}
                                  {isToolOp && (
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Tool name</label>
                                      <Input
                                        value={assertion.expected}
                                        onChange={(e) => updateAssertion(tc.id, ai, { expected: e.target.value })}
                                        placeholder="e.g. web_search"
                                        className="h-6 text-[11px] font-mono"
                                      />
                                      {ar && !ar.passed && Array.isArray(ar.actual) && (
                                        <div className="rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive mt-1">
                                          tools called: <span className="font-mono">{(ar.actual as string[]).join(', ') || 'none'}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Deterministic expected value */}
                                  {!isJudge && !isSemanticMatch && !isToolOp && NEEDS_EXPECTED.has(op) && (
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Expected value</label>
                                      <Input
                                        value={assertion.expected}
                                        onChange={(e) => updateAssertion(tc.id, ai, { expected: e.target.value })}
                                        placeholder={cat === 'metric' ? 'e.g. 5000' : '"success" or 0.9'}
                                        className="h-6 text-[11px] font-mono"
                                      />
                                    </div>
                                  )}

                                  {/* Failure detail */}
                                  {ar && !ar.passed && !isJudge && !isSemanticMatch && !isToolOp && (
                                    <div className="rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive space-y-0.5">
                                      {ar.source && ar.source !== 'output' && (
                                        <div>source: <span className="font-mono">{ar.source}</span></div>
                                      )}
                                      <div>actual: <span className="font-mono">{JSON.stringify(ar.actual)}</span></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Trial breakdown */}
                      {result?.trialResults && result.trialResults.length > 1 && (
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                            Trial results ({Math.round(result.passRate * 100)}% pass rate)
                          </label>
                          <div className="flex gap-1">
                            {result.trialResults.map((trial, ti) => (
                              <div
                                key={ti}
                                title={trial.error ?? (trial.passed ? 'passed' : 'failed')}
                                className={`flex-1 rounded h-1.5 ${trial.passed ? 'bg-green-500' : 'bg-destructive/60'}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Execution link */}
                      {result?.executionId && (
                        <div className="text-[10px] text-muted-foreground">
                          Execution: <span className="font-mono">{result.executionId}</span>
                          {result.error && (
                            <span className="ml-2 text-destructive">{result.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {testCases.length > 0 && !running && (
        <div className="shrink-0 border-t border-border px-4 py-2">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Eval cases are saved with the workflow. Save the workflow to persist them.
          </p>
        </div>
      )}
    </div>
  );
}
