'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, Cancel01Icon, Loading01Icon } from '@hugeicons/core-free-icons';

export interface Log {
  id: string;
  nodeId: string;
  level: 'info' | 'error';
  message: string;
  data?: { output?: unknown; error?: string } | null;
  durationMs?: number | null;
  timestamp: string;
}

export function formatRunTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export function StatusIcon({ status }: { status: string }) {
  if (status === 'running')   return <HugeiconsIcon icon={Loading01Icon}          className="size-3 text-blue-500 animate-spin shrink-0" />;
  if (status === 'completed') return <HugeiconsIcon icon={CheckmarkCircle01Icon}  className="size-3 text-green-500 shrink-0" />;
  if (status === 'failed')    return <HugeiconsIcon icon={Cancel01Icon}            className="size-3 text-red-500 shrink-0" />;
  return <span className="size-3 rounded-full border border-border bg-muted/60 shrink-0 inline-block" />;
}

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusColor(status: string) {
  if (status === 'running')   return 'text-blue-500';
  if (status === 'completed') return 'text-green-600';
  if (status === 'failed')    return 'text-red-500';
  return 'text-muted-foreground';
}
