'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, Cancel01Icon, Loading01Icon, PlayIcon, TestTube01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { friendlyApiError } from '@/lib/api';
import { useApiClient } from '@/hooks/use-api-client';
import { toast } from '@linea/ui/components/sonner';
import { EvalCaseCard } from './eval-case-card';
import type { InputVar } from './eval-input-form';
import { NEEDS_EXPECTED } from './eval-assertion-utils';
import type { Assertion, TestCase, TestCaseResult, WorkflowNodeMeta } from './evals-panel.types';

interface EvalsPanelProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  onClose: () => void;
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
  inputVariables?: InputVar[];
  workflowNodes?: WorkflowNodeMeta[];
}

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

export function EvalsPanel({
  workspaceId, podId, workflowId, onClose, testCases, onTestCasesChange, inputVariables, workflowNodes,
}: EvalsPanelProps) {
  const getApi = useApiClient();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestCaseResult[] | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(testCases[0]?.id ?? null);

  const { control, watch, getValues, reset } = useForm<{ testCases: TestCase[] }>({
    defaultValues: { testCases },
  });
  const { fields, append, remove, update } = useFieldArray({ control, name: 'testCases', keyName: '_fieldKey' });

  const testCasesRef = useRef(testCases);
  testCasesRef.current = testCases;

  // Re-seed only when a different workflow loads — testCases itself isn't a dep,
  // since onTestCasesChange below would otherwise echo straight back into a reset loop.
  useEffect(() => {
    reset({ testCases: testCasesRef.current });
  }, [workflowId, reset]);

  useEffect(() => {
    const sub = watch((value) => onTestCasesChange((value.testCases ?? []) as TestCase[]));
    return () => sub.unsubscribe();
  }, [watch, onTestCasesChange]);

  function addCase() {
    const c = newCase();
    append(c);
    setExpandedCase(c.id);
  }

  function removeCase(index: number, id: string) {
    remove(index);
    if (expandedCase === id) setExpandedCase(null);
  }

  function updateCase(index: number, patch: Partial<TestCase>) {
    update(index, { ...getValues().testCases[index]!, ...patch });
  }

  function addAssertion(index: number) {
    const current = getValues().testCases[index]!;
    update(index, { ...current, assertions: [...current.assertions, newAssertion()] });
  }

  function updateAssertion(index: number, idx: number, patch: Partial<Assertion>) {
    const current = getValues().testCases[index]!;
    update(index, {
      ...current,
      assertions: current.assertions.map((a, i) => i === idx ? { ...a, ...patch } : a),
    });
  }

  function removeAssertion(index: number, idx: number) {
    const current = getValues().testCases[index]!;
    update(index, { ...current, assertions: current.assertions.filter((_, i) => i !== idx) });
  }

  async function runAll() {
    const currentCases = getValues().testCases;
    if (currentCases.length === 0) return;
    setRunning(true);
    setResults(null);

    const payload = currentCases.map((tc) => {
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
      const api = await getApi();
      const res = await api.post<TestCaseResult[]>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/evals/run`,
        { testCases: payload },
      );
      setResults(res);
    } catch (err) {
      toast.error(friendlyApiError(err));
    } finally {
      setRunning(false);
    }
  }

  const passCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
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
            disabled={running || fields.length === 0}
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

      {results && (
        <div className={`shrink-0 px-4 py-2 text-xs font-medium border-b border-border ${passCount === totalCount ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
          {passCount}/{totalCount} eval cases passed
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {fields.length === 0 ? (
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
            {fields.map((tc, index) => (
              <EvalCaseCard
                key={tc._fieldKey}
                testCase={tc}
                result={results?.find((r) => r.caseId === tc.id)}
                isExpanded={expandedCase === tc.id}
                onToggleExpand={() => setExpandedCase(expandedCase === tc.id ? null : tc.id)}
                inputVariables={inputVariables}
                workflowNodes={workflowNodes}
                onUpdate={(patch) => updateCase(index, patch)}
                onRemove={() => removeCase(index, tc.id)}
                onAddAssertion={() => addAssertion(index)}
                onUpdateAssertion={(idx, patch) => updateAssertion(index, idx, patch)}
                onRemoveAssertion={(idx) => removeAssertion(index, idx)}
              />
            ))}
          </div>
        )}
      </div>

      {fields.length > 0 && !running && (
        <div className="shrink-0 border-t border-border px-4 py-2">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Eval cases are saved with the workflow. Save the workflow to persist them.
          </p>
        </div>
      )}
    </div>
  );
}
