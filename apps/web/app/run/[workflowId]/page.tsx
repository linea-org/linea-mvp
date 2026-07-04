'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';
import { friendlyApiErrorFromStatus, API_BASE } from '@/lib/api';

interface InputVariable {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  defaultValue?: string;
}

interface WorkflowSchema {
  id: string;
  name: string;
  description: string | null;
  inputVariables: InputVariable[];
}

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'forbidden' | 'not-found';
type SchemaOutcome =
  | { kind: 'ok'; schema: WorkflowSchema }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'error' };

export default function PublicRunPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [formState, setFormState] = useState<'ready' | 'submitting' | 'success'>('ready');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [defaultsFor, setDefaultsFor] = useState<string | null>(null);

  const { data: outcome, isLoading: schemaLoading } = useQuery<SchemaOutcome>({
    queryKey: ['public-run-schema', workflowId],
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/run/${workflowId}`);
        if (res.status === 404) return { kind: 'not-found' };
        if (res.status === 403) return { kind: 'forbidden' };
        if (!res.ok) return { kind: 'error' };
        const data = (await res.json()) as WorkflowSchema;
        return { kind: 'ok', schema: data };
      } catch {
        return { kind: 'error' };
      }
    },
  });

  const schema = outcome?.kind === 'ok' ? outcome.schema : null;

  if (schema && defaultsFor !== workflowId) {
    setDefaultsFor(workflowId);
    const defaults: Record<string, string> = {};
    for (const v of schema.inputVariables) {
      if (v.defaultValue) defaults[v.name] = v.defaultValue;
    }
    setInputs(defaults);
  }

  const state: PageState = schemaLoading ? 'loading'
    : !outcome || outcome.kind === 'error' ? 'error'
    : outcome.kind === 'not-found' ? 'not-found'
    : outcome.kind === 'forbidden' ? 'forbidden'
    : formState;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schema) return;
    setFormState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/run/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });
      if (!res.ok) {
        let bodyMsg: string | undefined;
        try {
          const body = await res.json() as { message?: string; error?: { message?: string } };
          bodyMsg = body?.error?.message ?? body?.message;
        } catch { /* ignore */ }
        const mappedMsg = res.status === 401
          ? 'This workflow is not publicly accessible.'
          : friendlyApiErrorFromStatus(res.status);
        setErrorMsg(mappedMsg ?? bodyMsg ?? 'Failed to start. Please try again.');
        setFormState('ready');
        return;
      }
      const result = (await res.json()) as { executionId: string };
      setExecutionId(result.executionId);
      setFormState('success');
    } catch {
      setErrorMsg('Connection failed. Check your internet.');
      setFormState('ready');
    }
  }

  if (state === 'loading') {
    return (
      <Shell>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />
        <Skeleton className="h-10 w-full mb-3" />
        <Skeleton className="h-10 w-full mb-6" />
        <Skeleton className="h-9 w-24" />
      </Shell>
    );
  }

  if (state === 'not-found') {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Workflow not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This workflow doesn&apos;t exist or the link is incorrect.
        </p>
      </Shell>
    );
  }

  if (state === 'forbidden') {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Not publicly accessible</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This workflow has not been made publicly runnable by its owner.
        </p>
      </Shell>
    );
  }

  if (state === 'error') {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">Failed to load the workflow. Try refreshing.</p>
        <Button className="mt-4" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
      </Shell>
    );
  }

  if (state === 'success') {
    return (
      <Shell>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-green-500 text-white text-lg font-bold">✓</span>
          <div>
            <p className="font-semibold">Submitted!</p>
            <p className="text-sm text-muted-foreground">{schema?.name}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Your request has been queued and is now running.
        </p>
        {executionId && (
          <p className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1 inline-block">
            ID: {executionId}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
          onClick={() => { setInputs({}); setFormState('ready'); setExecutionId(null); }}
        >
          Submit another
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-lg font-semibold">{schema?.name}</h1>
      {schema?.description && (
        <p className="mt-1 text-sm text-muted-foreground">{schema.description}</p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        {schema?.inputVariables.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
            This workflow takes no inputs.
          </p>
        ) : (
          schema?.inputVariables.map((v) => (
            <div key={v.name} className="space-y-1.5">
              <Label htmlFor={v.name}>
                {v.name}
                {v.required && <span className="ml-1 text-destructive">*</span>}
              </Label>
              {v.description && (
                <p className="text-xs text-muted-foreground">{v.description}</p>
              )}
              <Input
                id={v.name}
                placeholder={v.defaultValue ?? v.type}
                value={inputs[v.name] ?? ''}
                onChange={(e) => setInputs((p) => ({ ...p, [v.name]: e.target.value }))}
                required={v.required}
              />
            </div>
          ))
        )}

        {errorMsg && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={state === 'submitting'}
        >
          {state === 'submitting' ? 'Running…' : 'Run workflow'}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/20 flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground">
            <span className="text-background text-xs font-bold">L</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Powered by Linea</span>
        </div>
        {children}
      </div>
    </div>
  );
}
