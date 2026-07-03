'use client';

import { useState } from 'react';
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

      {results && (
        <div className={`shrink-0 px-4 py-2 text-xs font-medium border-b border-border ${passCount === totalCount ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
          {passCount}/{totalCount} eval cases passed
        </div>
      )}

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
            {testCases.map((tc) => (
              <EvalCaseCard
                key={tc.id}
                testCase={tc}
                result={results?.find((r) => r.caseId === tc.id)}
                isExpanded={expandedCase === tc.id}
                onToggleExpand={() => setExpandedCase(expandedCase === tc.id ? null : tc.id)}
                inputVariables={inputVariables}
                workflowNodes={workflowNodes}
                onUpdate={(patch) => updateCase(tc.id, patch)}
                onRemove={() => removeCase(tc.id)}
                onAddAssertion={() => addAssertion(tc.id)}
                onUpdateAssertion={(idx, patch) => updateAssertion(tc.id, idx, patch)}
                onRemoveAssertion={(idx) => removeAssertion(tc.id, idx)}
              />
            ))}
          </div>
        )}
      </div>

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
