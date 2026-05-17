'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';

interface LogicPanelProps {
  data: Record<string, unknown>;
  nodeType: string;
  onUpdate: (data: Record<string, unknown>) => void;
}

interface Route { id: string; label: string; condition: string }

export function LogicPanel({ data, nodeType, onUpdate }: LogicPanelProps) {
  const isRouter = nodeType === 'router';
  const routes: Route[] = (data.routes as Route[]) ?? [];

  function updateRoute(index: number, field: 'label' | 'condition', value: string) {
    onUpdate({ routes: routes.map((r, i) => (i === index ? { ...r, [field]: value } : r)) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="logic-condition">Condition</Label>
        <Input
          id="logic-condition"
          value={(data.condition as string) ?? ''}
          onChange={(e) => onUpdate({ condition: e.target.value })}
          placeholder="e.g. {{score}} > 0.8"
          className="font-mono text-xs"
        />
      </div>

      {!isRouter && (
        <>
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
            <Label>Routes</Label>
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
                <div key={i} className="space-y-1.5 rounded-md border border-border bg-muted/30 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">Route {i + 1}</span>
                    <Button
                      size="icon-xs"
                      variant="destructive"
                      onClick={() => onUpdate({ routes: routes.filter((_, j) => j !== i) })}
                    >
                      <HugeiconsIcon icon={Delete01Icon} />
                    </Button>
                  </div>
                  <Input
                    value={route.label}
                    onChange={(e) => updateRoute(i, 'label', e.target.value)}
                    placeholder="Label"
                  />
                  <Input
                    value={route.condition}
                    onChange={(e) => updateRoute(i, 'condition', e.target.value)}
                    placeholder="Condition e.g. {{type}} === 'premium'"
                    className="font-mono text-[11px]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
