"use client"

<<<<<<< HEAD
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Skeleton } from "@linea/ui/components/skeleton"
import { friendlyApiErrorFromStatus } from "@/lib/api"

const API_BASE = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/v1`
=======
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Skeleton } from '@linea/ui/components/skeleton';
import { friendlyApiErrorFromStatus, API_BASE } from '@/lib/api';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

interface InputVariable {
  name: string
  type: string
  required?: boolean
  description?: string
  defaultValue?: string
}

interface WorkflowSchema {
  id: string
  name: string
  description: string | null
  inputVariables: InputVariable[]
}

<<<<<<< HEAD
type PageState =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "error"
  | "forbidden"
  | "not-found"

export default function PublicRunPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const [state, setState] = useState<PageState>("loading")
  const [schema, setSchema] = useState<WorkflowSchema | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
=======
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
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  const { data: outcome, isLoading: schemaLoading } = useQuery<SchemaOutcome>({
    queryKey: ['public-run-schema', workflowId],
    retry: false,
    queryFn: async () => {
      try {
<<<<<<< HEAD
        const res = await fetch(`${API_BASE}/run/${workflowId}`)
        if (res.status === 404) {
          setState("not-found")
          return
        }
        if (res.status === 403) {
          setState("forbidden")
          return
        }
        if (!res.ok) {
          setState("error")
          return
        }
        const data = (await res.json()) as WorkflowSchema
        setSchema(data)
        // Pre-fill defaults
        const defaults: Record<string, string> = {}
        for (const v of data.inputVariables) {
          if (v.defaultValue) defaults[v.name] = v.defaultValue
        }
        setInputs(defaults)
        setState("ready")
      } catch {
        setState("error")
=======
        const res = await fetch(`${API_BASE}/run/${workflowId}`);
        if (res.status === 404) return { kind: 'not-found' };
        if (res.status === 403) return { kind: 'forbidden' };
        if (!res.ok) return { kind: 'error' };
        const data = (await res.json()) as WorkflowSchema;
        return { kind: 'ok', schema: data };
      } catch {
        return { kind: 'error' };
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
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
<<<<<<< HEAD
    void load()
  }, [workflowId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!schema) return
    setState("submitting")
    setErrorMsg("")
=======
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
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    try {
      const res = await fetch(`${API_BASE}/run/${workflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      })
      if (!res.ok) {
        let bodyMsg: string | undefined
        try {
<<<<<<< HEAD
          const body = (await res.json()) as {
            message?: string
            error?: { message?: string }
          }
          bodyMsg = body?.error?.message ?? body?.message
        } catch {
          /* ignore */
        }
        const mappedMsg =
          res.status === 401
            ? "This workflow is not publicly accessible."
            : friendlyApiErrorFromStatus(res.status)
        setErrorMsg(
          mappedMsg ?? bodyMsg ?? "Failed to start. Please try again."
        )
        setState("ready")
        return
      }
      const result = (await res.json()) as { executionId: string }
      setExecutionId(result.executionId)
      setState("success")
    } catch {
      setErrorMsg("Connection failed. Check your internet.")
      setState("ready")
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === "loading") {
=======
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
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    return (
      <Shell>
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="mb-8 h-4 w-72" />
        <Skeleton className="mb-3 h-10 w-full" />
        <Skeleton className="mb-6 h-10 w-full" />
        <Skeleton className="h-9 w-24" />
      </Shell>
    )
  }

<<<<<<< HEAD
  // ── Not found ────────────────────────────────────────────────────────────
  if (state === "not-found") {
=======
  if (state === 'not-found') {
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Workflow not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This workflow doesn&apos;t exist or the link is incorrect.
        </p>
      </Shell>
    )
  }

<<<<<<< HEAD
  // ── Not public ───────────────────────────────────────────────────────────
  if (state === "forbidden") {
=======
  if (state === 'forbidden') {
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Not publicly accessible</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This workflow has not been made publicly runnable by its owner.
        </p>
      </Shell>
    )
  }

<<<<<<< HEAD
  // ── Generic error ─────────────────────────────────────────────────────────
  if (state === "error") {
=======
  if (state === 'error') {
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Failed to load the workflow. Try refreshing.
        </p>
        <Button
          className="mt-4"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
      </Shell>
    )
  }

<<<<<<< HEAD
  // ── Success ───────────────────────────────────────────────────────────────
  if (state === "success") {
=======
  if (state === 'success') {
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    return (
      <Shell>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-green-500 text-lg font-bold text-white">
            ✓
          </span>
          <div>
            <p className="font-semibold">Submitted!</p>
            <p className="text-sm text-muted-foreground">{schema?.name}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Your request has been queued and is now running.
        </p>
        {executionId && (
          <p className="mt-2 inline-block rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
            ID: {executionId}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
<<<<<<< HEAD
          onClick={() => {
            setInputs({})
            setState("ready")
            setExecutionId(null)
          }}
=======
          onClick={() => { setInputs({}); setFormState('ready'); setExecutionId(null); }}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
        >
          Submit another
        </Button>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-lg font-semibold">{schema?.name}</h1>
      {schema?.description && (
        <p className="mt-1 text-sm text-muted-foreground">
          {schema.description}
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        {schema?.inputVariables.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
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
                value={inputs[v.name] ?? ""}
                onChange={(e) =>
                  setInputs((p) => ({ ...p, [v.name]: e.target.value }))
                }
                required={v.required}
              />
            </div>
          ))
        )}

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        <Button
          type="submit"
          className="w-full"
          disabled={state === "submitting"}
        >
          {state === "submitting" ? "Running…" : "Run workflow"}
        </Button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/20 px-4 pt-20">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground">
            <span className="text-xs font-bold text-background">L</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Powered by Linea
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
