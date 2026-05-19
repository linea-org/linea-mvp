'use client';

import { useState } from 'react';
import { useWorkflow } from '../hooks/use-workflow';

export interface WorkflowInputField {
  name: string;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'email' | 'url' | 'textarea';
  required?: boolean;
}

export interface WorkflowRunnerProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  /** Input fields to render. If omitted, renders no form fields and triggers with empty input. */
  inputs?: WorkflowInputField[];
  /** Called when the workflow completes successfully */
  onResult?: (output: unknown) => void;
  /** Called when the workflow fails */
  onError?: (error: string) => void;
  /** Render the result however you like. Defaults to a JSON code block. */
  renderResult?: (output: unknown) => React.ReactNode;
  /** Override button labels */
  labels?: { run?: string; running?: string; reset?: string };
  className?: string;
}

export function WorkflowRunner({
  workspaceId,
  podId,
  workflowId,
  inputs = [],
  onResult,
  onError,
  renderResult,
  labels = {},
  className,
}: WorkflowRunnerProps) {
  const { status, execution, error, run, reset } = useWorkflow();
  const [form, setForm] = useState<Record<string, string>>({});

  async function handleRun() {
    const input = Object.fromEntries(
      inputs
        .filter((f) => form[f.name] !== undefined && form[f.name] !== '')
        .map((f) => [f.name, f.type === 'number' ? Number(form[f.name]) : form[f.name]]),
    );
    try {
      const ex = await run({ workspaceId, podId, workflowId, input });
      if (ex.output) onResult?.(ex.output);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      onError?.(msg);
    }
  }

  const isRunning = status === 'running';

  return (
    <div className={`linea-runner${className ? ` ${className}` : ''}`} data-status={status}>
      {inputs.length > 0 && (
        <div className="linea-runner__fields">
          {inputs.map((field) => (
            <div key={field.name} className="linea-runner__field">
              {field.label && (
                <label className="linea-runner__label" htmlFor={`linea-${field.name}`}>
                  {field.label}
                  {field.required && <span className="linea-runner__required"> *</span>}
                </label>
              )}
              {field.type === 'textarea' ? (
                <textarea
                  id={`linea-${field.name}`}
                  className="linea-runner__textarea"
                  placeholder={field.placeholder ?? field.name}
                  value={form[field.name] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  disabled={isRunning}
                  rows={3}
                />
              ) : (
                <input
                  id={`linea-${field.name}`}
                  className="linea-runner__input"
                  type={field.type ?? 'text'}
                  placeholder={field.placeholder ?? field.name}
                  value={form[field.name] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  disabled={isRunning}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="linea-runner__actions">
        {status === 'idle' || status === 'running' ? (
          <button
            className="linea-runner__button linea-runner__button--primary"
            onClick={() => void handleRun()}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <span className="linea-runner__spinner" aria-hidden />
                {labels.running ?? 'Running…'}
              </>
            ) : (
              labels.run ?? 'Run workflow'
            )}
          </button>
        ) : (
          <button
            className="linea-runner__button linea-runner__button--secondary"
            onClick={reset}
          >
            {labels.reset ?? 'Run again'}
          </button>
        )}
      </div>

      {status === 'completed' && execution?.output != null && (
        <div className="linea-runner__result">
          <p className="linea-runner__result-label">Result</p>
          {renderResult ? (
            renderResult(execution.output)
          ) : (
            <pre className="linea-runner__result-code">
              {JSON.stringify(execution.output, null, 2)}
            </pre>
          )}
        </div>
      )}

      {status === 'failed' && error && (
        <div className="linea-runner__error" role="alert">
          <span className="linea-runner__error-icon" aria-hidden>✕</span>
          <span className="linea-runner__error-text">{error}</span>
        </div>
      )}
    </div>
  );
}
