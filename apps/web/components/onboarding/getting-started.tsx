'use client';

import { useState, useEffect } from 'react';
import { usePod } from '@/contexts/space-context';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';

const DISMISS_KEY = 'linea_gs_dismissed';
const WF_KEY = 'linea_gs_workflow';
const RUN_KEY = 'linea_gs_run';

interface Item {
  key: string;
  label: string;
  done: boolean;
}

export function GettingStarted() {
  const { pods } = usePod();
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const hasPod = pods.length > 0;
    const hasWorkflow = !!localStorage.getItem(WF_KEY);
    const hasRun = !!localStorage.getItem(RUN_KEY);

    const list: Item[] = [
      { key: 'pod', label: 'Create a pod', done: hasPod },
      { key: 'workflow', label: 'Build a workflow', done: hasWorkflow },
      { key: 'run', label: 'Run a workflow', done: hasRun },
    ];

    if (list.every((i) => i.done)) {
      localStorage.setItem(DISMISS_KEY, 'true');
      return;
    }

    setItems(list);
    setVisible(true);
  }, [pods.length]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  }

  if (!visible) return null;

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <div className="mx-2 mb-2 rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="flex-1 text-xs font-medium">Getting started</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {doneCount}/{total}
        </span>
        <HugeiconsIcon
          icon={collapsed ? ArrowDown01Icon : ArrowUp01Icon}
          className="size-3.5 text-muted-foreground shrink-0"
        />
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2.5">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                {item.done ? (
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-3.5 shrink-0 text-emerald-500"
                  />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-muted-foreground/30 inline-block" />
                )}
                <span
                  className={`text-xs ${
                    item.done ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={dismiss}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
