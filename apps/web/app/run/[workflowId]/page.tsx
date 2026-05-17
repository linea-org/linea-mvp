'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

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

export default function PublicRunPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [schema, setSchema] = useState<WorkflowSchema | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/run/${workflowId}`);
        if (res.status === 404) { setState('not-found'); return; }
        if (res.status === 403) { setState('forbidden'); return; }
        if (!res.ok) { setState('error'); return; }
        const data = (await res.json()) as WorkflowSchema;
        setSchema(data);
        // Pre-fill defaults
        const defaults: Record<string, string> = {};
        for (const v of data.inputVariables) {
          if (v.defaultValue) defaults[v.name] = v.defaultValue;
        }
        setInputs(defaults);
        setState('ready');
      } catch {
        setState('error');
      }
    }
    void load();
  }, [workflowId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schema) return;
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/run/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setErrorMsg(body.message ?? 'Failed to start. Please try again.');
        setState('ready');
        return;
      }
      const result = (await res.json()) as { executionId: string };
      setExecutionId(result.executionId);
      setState('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('ready');
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Not found ────────────────────────────────────────────────────────────
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

  // ── Not public ───────────────────────────────────────────────────────────
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

  // ── Generic error ─────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">Failed to load the workflow. Try refreshing.</p>
        <Button className="mt-4" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
      </Shell>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
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
          onClick={() => { setInputs({}); setState('ready'); setExecutionId(null); }}
        >
          Submit another
        </Button>
      </Shell>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
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
