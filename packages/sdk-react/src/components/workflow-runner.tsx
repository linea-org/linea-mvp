'use client';

import { useEffect, useState } from 'react';
import { useWorkflow } from '../hooks/use-workflow';
import type { NodeEvent } from '../hooks/use-workflow';

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

function NodeStatusIcon({ status }: { status: NodeEvent['status'] }) {
  if (status === 'running') return <span className="linea-runner__node-spinner" aria-hidden />;
  if (status === 'completed') return <span className="linea-runner__node-icon linea-runner__node-icon--ok" aria-hidden>✓</span>;
  if (status === 'failed') return <span className="linea-runner__node-icon linea-runner__node-icon--err" aria-hidden>✕</span>;
  if (status === 'suspended') return <span className="linea-runner__node-icon linea-runner__node-icon--pause" aria-hidden>⏸</span>;
  return null;
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
  const { status, execution, nodeEvents, suspended, error, run, respond, reset } = useWorkflow();
  const [form, setForm] = useState<Record<string, string>>({});
  const [humanAnswer, setHumanAnswer] = useState('');

  useEffect(() => {
    if (status === 'completed' && execution?.output != null) onResult?.(execution.output);
    if (status === 'failed' && error) onError?.(error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleRun() {
    const input = Object.fromEntries(
      inputs
        .filter((f) => form[f.name] !== undefined && form[f.name] !== '')
        .map((f) => [f.name, f.type === 'number' ? Number(form[f.name]) : form[f.name]]),
    );
    await run({ workspaceId, podId, workflowId, input });
  }

  async function handleApprove(approved: boolean) {
    await respond({ approved });
  }

  async function handleAnswer() {
    const answer = humanAnswer.trim();
    if (!answer) return;
    setHumanAnswer('');
    await respond({ answer });
  }

  const isRunning = status === 'running';
  const interrupt = suspended?.interrupt;

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
        {(status === 'idle' || status === 'running') && (
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
        )}
        {(status === 'completed' || status === 'failed') && (
          <button className="linea-runner__button linea-runner__button--secondary" onClick={reset}>
            {labels.reset ?? 'Run again'}
          </button>
        )}
      </div>
      {nodeEvents.length > 0 && (
        <ul className="linea-runner__nodes" aria-label="Node progress">
          {nodeEvents.map((ev) => (
            <li key={ev.nodeId} className={`linea-runner__node linea-runner__node--${ev.status}`}>
              <NodeStatusIcon status={ev.status} />
              <span className="linea-runner__node-label">{ev.nodeId}</span>
            </li>
          ))}
        </ul>
      )}
      {status === 'suspended' && interrupt && (
        <div className="linea-runner__suspend" role="region" aria-label="Workflow paused">
          <p className="linea-runner__suspend-title">
            {interrupt.type === 'ask_human' ? 'Question from agent' : 'Approval required'}
          </p>
          {(interrupt.question ?? interrupt.message) && (
            <p className="linea-runner__suspend-msg">{interrupt.question ?? interrupt.message}</p>
          )}
          {interrupt.context && (
            <p className="linea-runner__suspend-ctx">{interrupt.context}</p>
          )}
          {interrupt.type === 'tool_approval' && interrupt.toolName && (
            <p className="linea-runner__suspend-tool">
              Tool: <code>{interrupt.toolName as string}</code>
            </p>
          )}

          {interrupt.type === 'ask_human' ? (
            <div className="linea-runner__suspend-input-row">
              <input
                className="linea-runner__input"
                type="text"
                placeholder="Your answer…"
                value={humanAnswer}
                onChange={(e) => setHumanAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAnswer(); }}
                autoFocus
              />
              <button
                className="linea-runner__button linea-runner__button--primary"
                onClick={() => void handleAnswer()}
                disabled={!humanAnswer.trim()}
              >
                Send
              </button>
            </div>
          ) : (
            <div className="linea-runner__suspend-btns">
              <button
                className="linea-runner__button linea-runner__button--primary"
                onClick={() => void handleApprove(true)}
              >
                Approve
              </button>
              <button
                className="linea-runner__button linea-runner__button--secondary"
                onClick={() => void handleApprove(false)}
              >
                Deny
              </button>
            </div>
          )}
        </div>
      )}
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
