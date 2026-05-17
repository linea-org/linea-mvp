'use client';

import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Copy01Icon, CheckmarkCircle01Icon, Loading01Icon, Share01Icon } from '@hugeicons/core-free-icons';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';

interface Props {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onClose: () => void;
}

export function SharePanel({ workspaceId, podId, workflowId, token, onClose }: Props) {
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/run/${workflowId}` : `/run/${workflowId}`;

  useEffect(() => {
    async function fetch_() {
      try {
        const api = createApiClient(token);
        const wf = await api.get<{ isPublic?: boolean }>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`);
        setIsPublic(wf.isPublic ?? false);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void fetch_();
  }, [token, workspaceId, podId, workflowId]);

  async function toggle() {
    setSaving(true);
    try {
      const api = createApiClient(token);
      await api.patch(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`, { isPublic: !isPublic });
      setIsPublic((v) => !v);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Share01Icon} className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Share</span>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon icon={Loading01Icon} className="size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public access</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Anyone with the link can run this workflow
                </p>
              </div>
              <button
                onClick={() => void toggle()}
                disabled={saving}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${isPublic ? 'bg-primary' : 'bg-input'}`}
                role="switch"
                aria-checked={isPublic}
              >
                <span
                  className={`pointer-events-none inline-block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* URL */}
            {isPublic && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Public URL</p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <span className="flex-1 truncate text-xs font-mono text-foreground">{publicUrl}</span>
                  <button
                    onClick={() => void copy()}
                    title="Copy URL"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <HugeiconsIcon
                      icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
                      className={`size-3.5 ${copied ? 'text-green-500' : ''}`}
                    />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with anyone — no login required.
                </p>
              </div>
            )}

            {!isPublic && (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">
                Enable public access to get a shareable link.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
