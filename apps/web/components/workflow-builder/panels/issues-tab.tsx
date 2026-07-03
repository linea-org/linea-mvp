'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, Alert02Icon } from '@hugeicons/core-free-icons';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import type { ValidationState } from '../toolbar';

export function IssuesTab({ validationState }: { validationState: ValidationState }) {
  if (validationState.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-6 text-green-500/60" />
        <p className="text-xs text-muted-foreground">No issues detected. Workflow looks good.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1.5">
        {validationState.issues.map((issue, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
              validationState.level === 'error'
                ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                : 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
            }`}
          >
            <HugeiconsIcon
              icon={Alert02Icon}
              className={`size-3.5 shrink-0 mt-0.5 ${validationState.level === 'error' ? 'text-red-500' : 'text-amber-500'}`}
            />
            <span className={validationState.level === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}>
              {issue}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
