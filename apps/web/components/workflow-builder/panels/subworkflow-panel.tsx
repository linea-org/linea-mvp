'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { useWorkspace } from '@/contexts/workspace-context';
import { Label } from '@linea/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import { Skeleton } from '@linea/ui/components/skeleton';

interface Workflow {
  id: string;
  name: string;
}

interface SubworkflowPanelProps {
  data: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function SubworkflowPanel({ data, onUpdate }: SubworkflowPanelProps) {
  const { podId } = useParams<{ podId: string }>();
  const getApi = useApiClient();
  const { activeWorkspace } = useWorkspace();

  const { data: workflows = [], isLoading: loading } = useQuery<Workflow[]>({
    queryKey: ['pod-workflows', activeWorkspace?.id, podId],
    enabled: !!activeWorkspace && !!podId,
    queryFn: async () => {
      const api = await getApi();
      const res = await api.get<{ workflows: Workflow[] }>(
        `/workspaces/${activeWorkspace!.id}/pods/${podId}/workflows`,
      );
      return res.workflows ?? [];
    },
  });

  const selected = (data.workflowId as string) ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Workflow to call</Label>
        {loading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select value={selected} onValueChange={(v) => onUpdate({ workflowId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select a workflow…" />
            </SelectTrigger>
            <SelectContent>
              {workflows.map((wf) => (
                <SelectItem key={wf.id} value={wf.id}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          The selected workflow runs as a sub-step. Current variables are passed as its input.
          Its final output becomes this node&apos;s output.
        </p>
      </div>
    </div>
  );
}
