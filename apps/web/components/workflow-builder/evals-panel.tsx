'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, Delete01Icon, PlayIcon, Loading01Icon,
  Tick01Icon, Cancel01Icon, TestTube01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Textarea } from '@linea/ui/components/textarea';
import { createApiClient } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
type Operator = 'equals' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt';

interface Assertion {
  path: string;
  operator: Operator;
  expected: string;
}

interface TestCase {
  id: string;
  name: string;
  input: string;
  assertions: Assertion[];
}

interface AssertionResult {
  path: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

interface TestCaseResult {
  caseId: string;
  name: string;
  passed: boolean;
  assertions: AssertionResult[];
  executionId: string;
  status: string;
  error?: string;
}

interface EvalsPanelProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onClose: () => void;
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function newCase(): TestCase {
  return {
    id: Math.random().toString(36).slice(2, 9),
    name: 'Eval case',
    input: '{}',
    assertions: [{ path: '', operator: 'exists', expected: '' }],
  };
}

function newAssertion(): Assertion {
  return { path: '', operator: 'exists', expected: '' };
}

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'equals',
  contains: 'contains',
  exists: 'exists',
  not_exists: 'not exists',
  gt: 'greater than',
  lt: 'less than',
};

const NEEDS_EXPECTED = new Set<Operator>(['equals', 'contains', 'gt', 'lt']);

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export function EvalsPanel({
  workspaceId, podId, workflowId, token, onClose, testCases, onTestCasesChange,
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
        assertions: tc.assertions.map((a) => ({
          path: a.path,
          operator: a.operator,
          expected: NEEDS_EXPECTED.has(a.operator)
            ? (() => { try { return JSON.parse(a.expected); } catch { return a.expected; } })()
            : undefined,
        })),
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
                    <span className="text-[10px] text-muted-foreground">
                      {tc.assertions.length} assertion{tc.assertions.length !== 1 ? 's' : ''}
                    </span>
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
                        <Button
                          size="icon-xs"
                          variant="destructive"
                          className="mt-5 shrink-0"
                          onClick={() => removeCase(tc.id)}
                        >
                          <HugeiconsIcon icon={Delete01Icon} />
                        </Button>
                      </div>

                      {/* Input JSON */}
                      <div className="space-y-1">
                        <Label className="text-[10px]">Input JSON</Label>
                        <Textarea
                          value={tc.input}
                          onChange={(e) => updateCase(tc.id, { input: e.target.value })}
                          className="font-mono text-[11px] min-h-[60px] resize-none"
                          placeholder='{"key": "value"}'
                        />
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
                              return (
                                <div
                                  key={ai}
                                  className={`rounded-md border p-2 space-y-1.5 ${ar ? (ar.passed ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20') : 'border-border bg-background'}`}
                                >
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
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      onClick={() => removeAssertion(tc.id, ai)}
                                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                    >
                                      <HugeiconsIcon icon={Delete01Icon} className="size-3" />
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Path</label>
                                      <Input
                                        value={assertion.path}
                                        onChange={(e) => updateAssertion(tc.id, ai, { path: e.target.value })}
                                        placeholder="e.g. result.score"
                                        className="h-6 text-[11px] font-mono"
                                      />
                                    </div>
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Check</label>
                                      <NativeSelect
                                        value={assertion.operator}
                                        onChange={(e) => updateAssertion(tc.id, ai, { operator: e.target.value as Operator })}
                                        className="h-6 text-[11px]"
                                      >
                                        {(Object.entries(OPERATOR_LABELS) as [Operator, string][]).map(([op, label]) => (
                                          <NativeSelectOption key={op} value={op}>{label}</NativeSelectOption>
                                        ))}
                                      </NativeSelect>
                                    </div>
                                  </div>

                                  {NEEDS_EXPECTED.has(assertion.operator) && (
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Expected value</label>
                                      <Input
                                        value={assertion.expected}
                                        onChange={(e) => updateAssertion(tc.id, ai, { expected: e.target.value })}
                                        placeholder='e.g. "success" or 0.9'
                                        className="h-6 text-[11px] font-mono"
                                      />
                                    </div>
                                  )}

                                  {ar && !ar.passed && (
                                    <div className="rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                                      actual: <span className="font-mono">{JSON.stringify(ar.actual)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

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
