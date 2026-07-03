'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete01Icon, Tick01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Textarea } from '@linea/ui/components/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@linea/ui/components/select';
import { NEEDS_EXPECTED, OPERATOR_LABELS, OPERATORS_FOR_SOURCE, getSourceCategory } from './eval-assertion-utils';
import type { Assertion, AssertionResult, Operator, WorkflowNodeMeta } from './evals-panel.types';

interface EvalAssertionRowProps {
  assertion: Assertion;
  index: number;
  result?: AssertionResult;
  workflowNodes?: WorkflowNodeMeta[];
  onUpdate: (patch: Partial<Assertion>) => void;
  onRemove: () => void;
}

export function EvalAssertionRow({ assertion, index, result: ar, workflowNodes, onUpdate, onRemove }: EvalAssertionRowProps) {
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
          Assertion {index + 1}
        </span>
        {ar?.score !== undefined && (
          <span className={`text-[10px] font-mono ${ar.passed ? 'text-green-600' : 'text-destructive'}`}>
            score: {ar.score.toFixed(2)}
          </span>
        )}
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onRemove}
          className="h-5 w-5 text-muted-foreground hover:text-destructive"
        >
          <HugeiconsIcon icon={Delete01Icon} className="size-3" />
        </Button>
      </div>

      <div className="space-y-0.5">
        <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Evaluate</label>
        <Select
          value={assertion.source ?? 'output'}
          onValueChange={(newSource) => {
            const newCat = getSourceCategory(newSource);
            const newOps = OPERATORS_FOR_SOURCE[newCat];
            const newOp = newOps.includes(op) ? op : newOps[0]!;
            onUpdate({ source: newSource, operator: newOp });
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

      <div className={`grid gap-1.5 ${showPath ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {showPath && (
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Path</label>
            <Input
              value={assertion.path}
              onChange={(e) => onUpdate({ path: e.target.value })}
              placeholder="e.g. result.score"
              className="h-6 text-[11px] font-mono"
            />
          </div>
        )}
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Check</label>
          <Select
            value={op}
            onValueChange={(v) => onUpdate({ operator: v as Operator })}
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

      {isJudge && (
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
              Output path (optional)
            </label>
            <Input
              value={assertion.path}
              onChange={(e) => onUpdate({ path: e.target.value })}
              placeholder="e.g. result.text (blank = whole output)"
              className="h-6 text-[11px] font-mono"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Rubric</label>
            <Textarea
              value={assertion.rubric}
              onChange={(e) => onUpdate({ rubric: e.target.value })}
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
              onChange={(e) => onUpdate({ threshold: e.target.value })}
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

      {isSemanticMatch && (
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
              Output path (optional)
            </label>
            <Input
              value={assertion.path}
              onChange={(e) => onUpdate({ path: e.target.value })}
              placeholder="e.g. result.text (blank = whole output)"
              className="h-6 text-[11px] font-mono"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Reference answer</label>
            <Textarea
              value={assertion.reference ?? ''}
              onChange={(e) => onUpdate({ reference: e.target.value })}
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
              onChange={(e) => onUpdate({ threshold: e.target.value })}
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

      {isToolOp && (
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Tool name</label>
          <Input
            value={assertion.expected}
            onChange={(e) => onUpdate({ expected: e.target.value })}
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

      {!isJudge && !isSemanticMatch && !isToolOp && NEEDS_EXPECTED.has(op) && (
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Expected value</label>
          <Input
            value={assertion.expected}
            onChange={(e) => onUpdate({ expected: e.target.value })}
            placeholder={cat === 'metric' ? 'e.g. 5000' : '"success" or 0.9'}
            className="h-6 text-[11px] font-mono"
          />
        </div>
      )}

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
}
