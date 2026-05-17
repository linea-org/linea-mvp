'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';

interface RouterPanelProps {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

interface Route {
  id: string;
  label: string;
  condition: string;
}

function newRoute(): Route {
  return { id: Math.random().toString(36).slice(2, 9), label: '', condition: '' };
}

export function RouterPanel({ data, onUpdate }: RouterPanelProps) {
  const routes: Route[] = (data.routes as Route[]) ?? [];

  function updateRoute(index: number, field: keyof Route, value: string) {
    onUpdate({ routes: routes.map((r, i) => (i === index ? { ...r, [field]: value } : r)) });
  }

  function removeRoute(index: number) {
    onUpdate({ routes: routes.filter((_, i) => i !== index) });
  }

  function addRoute() {
    onUpdate({ routes: [...routes, newRoute()] });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...routes];
    const tmp = next[index - 1]!;
    next[index - 1] = next[index]!;
    next[index] = tmp;
    onUpdate({ routes: next });
  }

  return (
    <div className="space-y-4">
      {/* Header note */}
      <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
        <p className="text-[11px] text-muted-foreground leading-snug">
          Routes are evaluated <span className="font-semibold text-foreground">top to bottom</span>. The first matching condition fires. If no route matches, execution stops.
        </p>
      </div>

      {/* Routes list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Routes</Label>
          <Button size="xs" variant="ghost" onClick={addRoute}>
            <HugeiconsIcon icon={Add01Icon} />
            Add route
          </Button>
        </div>

        {routes.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-6 text-center">
            <p className="text-xs text-muted-foreground">No routes defined.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Add a route to define branching paths.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {routes.map((route, i) => (
              <div key={route.id} className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
                {/* Route header */}
                <div className="flex items-center gap-1.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-bold text-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Route {i + 1}
                    {route.id && (
                      <span className="ml-1.5 font-mono normal-case tracking-normal text-muted-foreground/60">
                        · handle: {route.id}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {i > 0 && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="Move up"
                        onClick={() => moveUp(i)}
                      >
                        <HugeiconsIcon icon={ArrowDown01Icon} className="rotate-180" />
                      </Button>
                    )}
                    <Button
                      size="icon-xs"
                      variant="destructive"
                      title="Remove route"
                      onClick={() => removeRoute(i)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} />
                    </Button>
                  </div>
                </div>

                {/* Label */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Label</label>
                  <Input
                    value={route.label}
                    onChange={(e) => updateRoute(i, 'label', e.target.value)}
                    placeholder="e.g. premium, fallback, error"
                    className="h-7 text-xs"
                  />
                </div>

                {/* Condition */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Condition</label>
                  <Input
                    value={route.condition}
                    onChange={(e) => updateRoute(i, 'condition', e.target.value)}
                    placeholder={`e.g. {{type}} === 'premium'`}
                    className="h-7 font-mono text-[11px]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fallback note */}
      {routes.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
            Add a route with condition <span className="font-mono">true</span> as the last route to act as a catch-all fallback.
          </p>
        </div>
      )}
    </div>
  );
}
