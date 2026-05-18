'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  TestTube01Icon, PlayIcon, Loading01Icon, Tick01Icon, Cancel01Icon,
  ArrowDown01Icon, ArrowUp01Icon, Clock01Icon,
} from '@hugeicons/core-free-icons';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { NativeSelect, NativeSelectOption } from '@linea/ui/components/native-select';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Badge } from '@linea/ui/components/badge';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface Pod { id: string; name: string }
interface Workflow {
  id: string; name: string; podId: string;
  definition?: { settings?: { testCases?: StoredTestCase[] } };
}
interface StoredTestCase {
  id: string; name: string;
  input: string; // stored as JSON string in workflow definition
  trials?: number;
  scriptedResponses?: { type: 'answer' | 'approve' | 'deny'; value: string }[];
  assertions: { path: string; operator: string; expected: string; rubric?: string; threshold?: string }[];
}
interface AssertionResult {
  path: string; operator: string; expected: unknown; actual: unknown; passed: boolean;
  score?: number; reasoning?: string;
}
interface TrialResult { executionId: string; status: string; passed: boolean; assertions: AssertionResult[]; error?: string }
interface EvalResult {
  caseId: string; name: string; passed: boolean; passRate: number;
  assertions: AssertionResult[]; executionId: string; status: string; error?: string;
  trialResults?: TrialResult[];
}
interface EvalRunSummary {
  id: string; passCount: number; totalCount: number; createdAt: string;
  results: EvalResult[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function EvalsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? '';

  const [selectedPodId, setSelectedPodId] = useState('');
  const [selectedWfId, setSelectedWfId] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<EvalResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  /* ------ Data fetching ------ */

  const { data: pods, isLoading: podsLoading } = useQuery({
    queryKey: ['pods', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      return api.get<Pod[]>(`/workspaces/${wsId}/pods`);
    },
  });

  const { data: workflows, isLoading: wfLoading } = useQuery({
    queryKey: ['wf-evals', wsId, selectedPodId],
    enabled: !!wsId && !!selectedPodId,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      const res = await api.get<Workflow[]>(
        `/workspaces/${wsId}/pods/${selectedPodId}/workflows?limit=100`,
      );
      return (res ?? []).filter(
        (w) => (w.definition?.settings?.testCases?.length ?? 0) > 0,
      );
    },
  });

  const { data: runHistory } = useQuery({
    queryKey: ['eval-runs', selectedWfId, historyKey],
    enabled: !!selectedWfId && !!selectedPodId,
    retry: false, // table may not exist yet — don't spam retries
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      return api
        .get<EvalRunSummary[]>(`/workspaces/${wsId}/pods/${selectedPodId}/workflows/${selectedWfId}/evals/runs`)
        .catch(() => []); // gracefully handle missing table
    },
  });

  const selectedWorkflow = workflows?.find((w) => w.id === selectedWfId);
  const testCases: StoredTestCase[] = selectedWorkflow?.definition?.settings?.testCases ?? [];

  /* ------ Run ------ */

  async function runAll() {
    if (!selectedPodId || !selectedWfId || testCases.length === 0) return;
    setRunning(true);
    setResults(null);
    setRunError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);

      // Parse input strings → objects before sending
      const payload = testCases.map((tc) => {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.input) as Record<string, unknown>; } catch { input = {}; }
        return { ...tc, input };
      });

      const res = await api.post<EvalResult[]>(
        `/workspaces/${wsId}/pods/${selectedPodId}/workflows/${selectedWfId}/evals/run`,
        { testCases: payload },
      );
      setResults(res);
      setExpandedCase(res.find((r) => !r.passed)?.caseId ?? null);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  const passCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;

  /* ------ Render ------ */

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b border-border px-6 py-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
            <HugeiconsIcon icon={TestTube01Icon} className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Evals</h1>
            <p className="text-sm text-muted-foreground">Measure and track workflow performance over time</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Selectors row */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Pod</label>
            {podsLoading ? (
              <Skeleton className="h-9 w-44" />
            ) : (
              <NativeSelect
                value={selectedPodId}
                onChange={(e) => {
                  setSelectedPodId(e.target.value);
                  setSelectedWfId('');
                  setResults(null);
                }}
                className="h-9 text-sm"
              >
                <NativeSelectOption value="">Select a pod…</NativeSelectOption>
                {pods?.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          <div className="space-y-1.5 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Workflow</label>
            {wfLoading ? (
              <Skeleton className="h-9 w-52" />
            ) : (
              <NativeSelect
                value={selectedWfId}
                onChange={(e) => { setSelectedWfId(e.target.value); setResults(null); }}
                disabled={!selectedPodId}
                className="h-9 text-sm"
              >
                <NativeSelectOption value="">
                  {!selectedPodId
                    ? 'Select a pod first'
                    : (workflows?.length ?? 0) === 0
                    ? 'No workflows with eval cases'
                    : 'Select a workflow…'}
                </NativeSelectOption>
                {workflows?.map((w) => (
                  <NativeSelectOption key={w.id} value={w.id}>
                    {w.name} ({w.definition?.settings?.testCases?.length ?? 0})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          <Button
            onClick={() => void runAll()}
            disabled={!selectedWfId || testCases.length === 0 || running}
          >
            <HugeiconsIcon
              icon={running ? Loading01Icon : PlayIcon}
              className={running ? 'animate-spin' : ''}
            />
            {running ? 'Running…' : 'Run evals'}
          </Button>
        </div>

        {/* Empty state when no pod selected */}
        {!selectedPodId && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <HugeiconsIcon icon={TestTube01Icon} className="mx-auto size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Select a pod and workflow to get started</p>
            <p className="text-xs text-muted-foreground mt-1">
              Define eval cases inside any workflow using the Evals panel in the builder toolbar.
            </p>
          </div>
        )}

        {/* No workflows with eval cases */}
        {selectedPodId && !wfLoading && (workflows?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <HugeiconsIcon icon={TestTube01Icon} className="mx-auto size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No eval cases found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Open a workflow in the builder, click the Evals button in the toolbar, and add eval cases.
            </p>
          </div>
        )}

        {/* Eval cases list */}
        {selectedWfId && testCases.length > 0 && (
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Eval cases
                <span className="ml-1.5 text-muted-foreground font-normal text-xs">({testCases.length})</span>
              </h2>
              {results && (
                <Badge
                  variant={passCount === totalCount ? 'default' : 'destructive'}
                  className={passCount === totalCount ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : ''}
                >
                  {passCount}/{totalCount} passed
                </Badge>
              )}
            </div>

            {runError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {runError}
              </div>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
              {testCases.map((tc, idx) => {
                const result = results?.find((r) => r.caseId === tc.id);
                const isExpanded = expandedCase === tc.id;

                return (
                  <div key={tc.id} className={idx > 0 ? 'border-t border-border' : ''}>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedCase(isExpanded ? null : tc.id)}
                    >
                      {/* Status indicator */}
                      {result ? (
                        <HugeiconsIcon
                          icon={result.passed ? Tick01Icon : Cancel01Icon}
                          className={`size-4 shrink-0 ${result.passed ? 'text-green-500' : 'text-destructive'}`}
                        />
                      ) : running ? (
                        <HugeiconsIcon icon={Loading01Icon} className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tc.assertions.length} assertion{tc.assertions.length !== 1 ? 's' : ''}
                          {tc.trials && tc.trials > 1 ? ` · ${tc.trials} trials` : ''}
                          {result?.trialResults && (
                            <span className="ml-1">
                              · {result.trialResults.filter((t) => t.passed).length}/{result.trialResults.length} trials passed
                            </span>
                          )}
                        </p>
                      </div>

                      <HugeiconsIcon
                        icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                        className="size-3.5 text-muted-foreground shrink-0"
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border/50 space-y-3">
                        {/* Input */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Input</p>
                          <pre className="rounded bg-muted px-3 py-2 text-[11px] font-mono overflow-auto max-h-28 whitespace-pre-wrap break-all">
                            {tc.input}
                          </pre>
                        </div>

                        {/* Trial bar */}
                        {result?.trialResults && result.trialResults.length > 1 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Trials ({Math.round(result.passRate * 100)}% pass rate)
                            </p>
                            <div className="flex gap-1">
                              {result.trialResults.map((trial, ti) => (
                                <div
                                  key={ti}
                                  title={trial.error ?? (trial.passed ? 'passed' : 'failed')}
                                  className={`flex-1 rounded h-2 ${trial.passed ? 'bg-green-500' : 'bg-destructive/60'}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assertions */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                            Assertions
                          </p>
                          <div className="space-y-1.5">
                            {tc.assertions.map((a, ai) => {
                              const ar = result?.assertions[ai];
                              return (
                                <div
                                  key={ai}
                                  className={`flex items-start gap-2 rounded px-3 py-2 text-xs ${
                                    ar
                                      ? ar.passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
                                      : 'bg-muted/50'
                                  }`}
                                >
                                  {ar && (
                                    <HugeiconsIcon
                                      icon={ar.passed ? Tick01Icon : Cancel01Icon}
                                      className={`size-3.5 shrink-0 mt-px ${ar.passed ? 'text-green-500' : 'text-destructive'}`}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {a.operator === 'llm_judge' ? (
                                        <span className="text-muted-foreground">LLM judge</span>
                                      ) : (
                                        <>
                                          <span className="font-mono">{a.path || '(root)'}</span>
                                          <span className="text-muted-foreground">{a.operator}</span>
                                          {a.expected && <span className="font-mono">{a.expected}</span>}
                                        </>
                                      )}
                                      {ar?.score !== undefined && (
                                        <span className={`font-mono text-[10px] ${ar.passed ? 'text-green-600' : 'text-destructive'}`}>
                                          score: {ar.score.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    {ar?.reasoning && (
                                      <p className="mt-0.5 text-[10px] text-muted-foreground italic">{ar.reasoning}</p>
                                    )}
                                    {ar && !ar.passed && a.operator !== 'llm_judge' && (
                                      <div className="mt-1 text-destructive text-[10px]">
                                        actual: <span className="font-mono">{JSON.stringify(ar.actual)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {result?.executionId && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Execution: {result.executionId}
                            {result.error && <span className="ml-2 text-destructive">{result.error}</span>}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Run history */}
        {selectedWfId && (runHistory?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Clock01Icon} className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Run history</h2>
              <span className="text-xs text-muted-foreground">({runHistory!.length} run{runHistory!.length !== 1 ? 's' : ''})</span>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              {runHistory!.map((run, idx) => {
                const isExpanded = expandedRun === run.id;
                const allPassed = run.passCount === run.totalCount;

                return (
                  <div key={run.id} className={idx > 0 ? 'border-t border-border' : ''}>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                    >
                      <div className={`size-2 rounded-full shrink-0 ${allPassed ? 'bg-green-500' : 'bg-destructive'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {run.passCount}/{run.totalCount} passed
                          {run.totalCount > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              ({Math.round((run.passCount / run.totalCount) * 100)}%)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <HugeiconsIcon
                        icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                        className="size-3.5 text-muted-foreground shrink-0"
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-muted/10 border-t border-border/50 space-y-1">
                        {run.results.map((r) => (
                          <div key={r.caseId} className="flex items-center gap-2 text-xs py-0.5">
                            <HugeiconsIcon
                              icon={r.passed ? Tick01Icon : Cancel01Icon}
                              className={`size-3.5 shrink-0 ${r.passed ? 'text-green-500' : 'text-destructive'}`}
                            />
                            <span className="flex-1 truncate">{r.name}</span>
                            {r.trialResults && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {Math.round(r.passRate * 100)}% pass rate
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
