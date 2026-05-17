'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  TestTube01Icon, PlayIcon, Loading01Icon, Tick01Icon, Cancel01Icon,
  Add01Icon, ArrowDown01Icon, ArrowUp01Icon,
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
interface Pod { id: string; name: string; slug: string }
interface Workflow {
  id: string; name: string; podId: string;
  definition?: { settings?: { testCases?: TestCase[] } };
}
interface TestCase {
  id: string; name: string; input: string;
  assertions: { path: string; operator: string; expected: string }[];
}
interface AssertionResult { path: string; operator: string; expected: unknown; actual: unknown; passed: boolean }
interface EvalResult {
  caseId: string; name: string; passed: boolean;
  assertions: AssertionResult[]; executionId: string; status: string; error?: string;
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function EvalsPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? '';

  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedWfId, setSelectedWfId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<EvalResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const { data: pods, isLoading: podsLoading } = useQuery({
    queryKey: ['pods', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      const res = await api.get<{ pods: Pod[] }>(`/workspaces/${wsId}/pods`);
      return res.pods ?? [];
    },
  });

  const { data: workflows, isLoading: wfLoading } = useQuery({
    queryKey: ['workflows', wsId, selectedPodId],
    enabled: !!wsId && !!selectedPodId,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const api = createApiClient(token);
      const res = await api.get<{ workflows: Workflow[] }>(
        `/workspaces/${wsId}/pods/${selectedPodId}/workflows?limit=100`,
      );
      return (res.workflows ?? []).filter(
        (w) => (w.definition?.settings?.testCases?.length ?? 0) > 0,
      );
    },
  });

  const selectedWorkflow = workflows?.find((w) => w.id === selectedWfId);
  const testCases = selectedWorkflow?.definition?.settings?.testCases ?? [];

  async function runAll() {
    if (!selectedPodId || !selectedWfId || testCases.length === 0) return;
    setRunning(true);
    setResults(null);
    setRunError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const res = await api.post<EvalResult[]>(
        `/workspaces/${wsId}/pods/${selectedPodId}/workflows/${selectedWfId}/evals/run`,
        { testCases },
      );
      setResults(res);
      setExpandedCase(res.find((r) => !r.passed)?.caseId ?? null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  const passCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b border-border px-6 py-5">
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
        {/* Selectors */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Pod</label>
            {podsLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              <NativeSelect
                value={selectedPodId}
                onChange={(e) => { setSelectedPodId(e.target.value); setSelectedWfId(''); setResults(null); }}
                className="h-9 text-sm"
              >
                <NativeSelectOption value="">Select a pod…</NativeSelectOption>
                {pods?.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          <div className="space-y-1.5 min-w-[240px]">
            <label className="text-xs font-medium text-muted-foreground">Workflow</label>
            {wfLoading ? (
              <Skeleton className="h-9 w-56" />
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
                    {w.name} ({w.definition?.settings?.testCases?.length ?? 0} cases)
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

        {/* Hint if no workflow with test cases */}
        {selectedPodId && !wfLoading && (workflows?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <HugeiconsIcon icon={TestTube01Icon} className="mx-auto size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No eval cases yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Open any workflow in the builder and use the
              <HugeiconsIcon icon={TestTube01Icon} className="inline size-3.5 mx-1" />
              Evals panel in the toolbar to define eval cases.
            </p>
          </div>
        )}

        {/* Eval case list */}
        {selectedWfId && testCases.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Eval cases
                <span className="ml-2 text-muted-foreground font-normal">({testCases.length})</span>
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
                        </p>
                      </div>
                      <HugeiconsIcon
                        icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                        className="size-3.5 text-muted-foreground shrink-0"
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border/50 space-y-3">
                        {/* Input */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Input</p>
                          <pre className="rounded bg-muted px-3 py-2 text-[11px] font-mono overflow-auto max-h-28">
                            {tc.input}
                          </pre>
                        </div>

                        {/* Assertions */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Assertions</p>
                          <div className="space-y-1.5">
                            {tc.assertions.map((a, ai) => {
                              const ar = result?.assertions[ai];
                              return (
                                <div
                                  key={ai}
                                  className={`flex items-start gap-2 rounded px-3 py-2 text-xs ${
                                    ar
                                      ? ar.passed
                                        ? 'bg-green-50 dark:bg-green-950/20'
                                        : 'bg-red-50 dark:bg-red-950/20'
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
                                    <span className="font-mono">{a.path || '(root)'}</span>
                                    <span className="mx-1 text-muted-foreground">{a.operator}</span>
                                    {a.expected && <span className="font-mono">{a.expected}</span>}
                                    {ar && !ar.passed && (
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
      </div>
    </div>
  );
}
