'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Switch } from '@linea/ui/components/switch';

interface LogicPanelProps {
  data: Record<string, unknown>;
  nodeType: string;
  onUpdate: (data: Record<string, unknown>) => void;
}

interface Route { id: string; label: string; condition: string; isDefault?: boolean }

export function LogicPanel({ data, nodeType, onUpdate }: LogicPanelProps) {
  const isRouter = nodeType === 'router';
  const routes: Route[] = (data.routes as Route[]) ?? [];

  function updateRoute(index: number, patch: Partial<Route>) {
    onUpdate({ routes: routes.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }

  function toggleDefault(index: number) {
    onUpdate({
      routes: routes.map((r, i) => ({ ...r, isDefault: i === index ? !r.isDefault : false })),
    });
  }

  return (
    <div className="space-y-4">
      {/* Condition — only shown for if-else, not router */}
      {!isRouter && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="logic-condition">Condition</Label>
            <Input
              id="logic-condition"
              value={(data.condition as string) ?? ''}
              onChange={(e) => onUpdate({ condition: e.target.value })}
              placeholder="e.g. lastOutput.score > 0.8"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              jexl expression using <code className="font-mono">input</code>, <code className="font-mono">lastOutput</code>, <code className="font-mono">variables</code>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logic-true-label">True branch label</Label>
            <Input
              id="logic-true-label"
              value={(data.trueLabel as string) ?? 'true'}
              onChange={(e) => onUpdate({ trueLabel: e.target.value })}
              placeholder="true"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logic-false-label">False branch label</Label>
            <Input
              id="logic-false-label"
              value={(data.falseLabel as string) ?? 'false'}
              onChange={(e) => onUpdate({ falseLabel: e.target.value })}
              placeholder="false"
            />
          </div>
        </>
      )}

      {isRouter && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>Routes</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Evaluated top-to-bottom. First match wins.</p>
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onUpdate({ routes: [...routes, { id: Math.random().toString(36).slice(2, 9), label: '', condition: '' }] })}
            >
              <HugeiconsIcon icon={Add01Icon} />
              Add
            </Button>
          </div>

          {routes.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No routes — click Add to create one.</p>
          ) : (
            <div className="space-y-2">
              {routes.map((route, i) => (
                <div key={route.id} className={`space-y-1.5 rounded-md border p-2 ${route.isDefault ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">Route {i + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Default</span>
                      <Switch
                        checked={!!route.isDefault}
                        onCheckedChange={() => toggleDefault(i)}
                        className="h-4 w-7"
                      />
                      <Button
                        size="icon-xs"
                        variant="destructive"
                        onClick={() => onUpdate({ routes: routes.filter((_, j) => j !== i) })}
                      >
                        <HugeiconsIcon icon={Delete01Icon} />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={route.label}
                    onChange={(e) => updateRoute(i, { label: e.target.value })}
                    placeholder="Label"
                  />
                  {!route.isDefault && (
                    <Input
                      value={route.condition}
                      onChange={(e) => updateRoute(i, { condition: e.target.value })}
                      placeholder="lastOutput.type == 'premium'"
                      className="font-mono text-[11px]"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {!routes.some((r) => r.isDefault) && routes.length > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              No default route — execution will fail if no condition matches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
