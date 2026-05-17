'use client';

import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';

interface WaitPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

const UNITS = [
  { value: 'ms', label: 'Milliseconds' },
  { value: 's',  label: 'Seconds' },
  { value: 'm',  label: 'Minutes' },
  { value: 'h',  label: 'Hours' },
];

export function WaitPanel({ data, onUpdate }: WaitPanelProps) {
  const duration = (data.duration as number) ?? 1;
  const unit = (data.unit as string) ?? 's';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Duration</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => onUpdate({ duration: Number(e.target.value) || 1 })}
            className="w-28"
          />
          <Select value={unit} onValueChange={(v) => onUpdate({ unit: v })}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Maximum wait is 5 minutes regardless of configured value.</p>
      </div>
    </div>
  );
}
