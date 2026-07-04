'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, Tick01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import { EvalInputForm, type InputVar } from './eval-input-form';
import { EvalScriptedResponses } from './eval-scripted-responses';
import { EvalAssertionRow } from './eval-assertion-row';
import type { Assertion, TestCase, TestCaseResult, WorkflowNodeMeta } from './evals-panel.types';

interface EvalCaseCardProps {
  testCase: TestCase;
  result?: TestCaseResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  inputVariables?: InputVar[];
  workflowNodes?: WorkflowNodeMeta[];
  onUpdate: (patch: Partial<TestCase>) => void;
  onRemove: () => void;
  onAddAssertion: () => void;
  onUpdateAssertion: (idx: number, patch: Partial<Assertion>) => void;
  onRemoveAssertion: (idx: number) => void;
}

export function EvalCaseCard({
  testCase: tc, result, isExpanded, onToggleExpand, inputVariables, workflowNodes,
  onUpdate, onRemove, onAddAssertion, onUpdateAssertion, onRemoveAssertion,
}: EvalCaseCardProps) {
  return (
    <div className="border-b border-border">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={onToggleExpand}
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

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px]">Eval name</Label>
              <Input
                value={tc.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1 shrink-0">
              <Label className="text-[10px]">Trials (pass@k)</Label>
              <Select
                value={String(tc.trials ?? 1)}
                onValueChange={(v) => onUpdate({ trials: parseInt(v, 10) })}
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
              onClick={onRemove}
            >
              <HugeiconsIcon icon={Delete01Icon} />
            </Button>
          </div>

          <EvalInputForm
            inputVariables={inputVariables}
            value={tc.input}
            onChange={(json) => onUpdate({ input: json })}
          />

          <EvalScriptedResponses
            responses={tc.scriptedResponses ?? []}
            onChange={(responses) => onUpdate({ scriptedResponses: responses })}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Assertions</Label>
              <Button size="xs" variant="ghost" onClick={onAddAssertion}>
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
                {tc.assertions.map((assertion, ai) => (
                  <EvalAssertionRow
                    key={ai}
                    assertion={assertion}
                    index={ai}
                    result={result?.assertions[ai]}
                    workflowNodes={workflowNodes}
                    onUpdate={(patch) => onUpdateAssertion(ai, patch)}
                    onRemove={() => onRemoveAssertion(ai)}
                  />
                ))}
              </div>
            )}
          </div>

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
}
