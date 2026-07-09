'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { ApiError, createApiClient } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@linea/ui/components/avatar';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@linea/ui/components/select';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@linea/ui/components/table';
import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Calendar01Icon, Shield01Icon } from '@hugeicons/core-free-icons';

const PAGE_SIZE = 50;

interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogsResponse {
  items: AuditLog[];
  actionTypes: string[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

function actorFallback(name: string | null, email: string) {
  const source = name || email || 'System';
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'S';
}

function formatResourceType(type: string) {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAction(action: string) {
  const [resource, verb, ...rest] = action.split(/[._]/).filter(Boolean);
  if (resource && verb) {
    const readableVerb = [verb, ...rest].join(' ').replace(/_/g, ' ');
    return `${readableVerb.charAt(0).toUpperCase()}${readableVerb.slice(1)} ${resource.replace(/_/g, ' ')}`;
  }

  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function resourceLabel(log: AuditLog) {
  return log.resourceName || log.resourceId || '-';
}

export default function SettingsAuditLogPage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [action, setAction] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adminOnly, setAdminOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) {
      setLoading(false);
      return;
    }

    async function loadAuditLogs() {
      if (!activeWorkspace) return;
      setLoading(true);
      setAdminOnly(false);
      setError(null);

      try {
        const token = await getToken();
        if (!token) return;
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (action !== 'all') params.set('action', action);
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);

        const api = createApiClient(token);
        const data = await api.get<AuditLogsResponse>(`/workspaces/${activeWorkspace.id}/audit-logs?${params.toString()}`);
        setLogs(data.items ?? []);
        setActionTypes(data.actionTypes ?? []);
        setTotal(data.meta?.total ?? 0);
      } catch (err) {
        setLogs([]);
        setTotal(0);
        if (err instanceof ApiError && err.status === 403) {
          setAdminOnly(true);
        } else {
          setError(err instanceof Error ? err.message : 'Unable to load audit logs.');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadAuditLogs();
  }, [activeWorkspace, action, fromDate, getToken, page, toDate, wsLoading]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleActionTypes = useMemo(() => {
    const fromLogs = logs.map((log) => log.action);
    return Array.from(new Set([...actionTypes, ...fromLogs])).sort();
  }, [actionTypes, logs]);

  function resetFilters() {
    setAction('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  }

  const hasFilters = action !== 'all' || fromDate || toDate;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium">Audit Log</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Review workspace changes, actors, and affected resources.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="w-full min-w-48 flex-1 space-y-1.5 sm:w-auto">
          <Label className="text-xs">Action type</Label>
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {visibleActionTypes.map((type) => (
                <SelectItem key={type} value={type}>{formatAction(type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="audit-from" className="text-xs">From</Label>
            <div className="relative">
              <HugeiconsIcon icon={Calendar01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-from"
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(1);
                }}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to" className="text-xs">To</Label>
            <div className="relative">
              <HugeiconsIcon icon={Calendar01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-to"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(1);
                }}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={resetFilters}>
            Clear
          </Button>
        )}
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
        </div>
      ) : adminOnly ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            <HugeiconsIcon icon={Shield01Icon} className="size-5" />
          </div>
          <p className="text-sm font-medium">Admin only</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            You need an admin or owner role to view workspace audit events.
          </p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={Archive02Icon} className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No audit events found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasFilters ? 'Try adjusting the filters.' : 'The latest workspace changes will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total} events
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource type</TableHead>
                  <TableHead>Resource name/ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{formatTimestamp(log.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage src={log.actorAvatarUrl ?? undefined} alt={log.actorName ?? log.actorEmail} />
                          <AvatarFallback className="text-[10px]">{actorFallback(log.actorName, log.actorEmail)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{log.actorName ?? log.actorEmail}</p>
                          {log.actorName && <p className="truncate text-[11px] text-muted-foreground">{log.actorEmail}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300">
                        {formatAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatResourceType(log.resourceType)}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground" title={resourceLabel(log)}>
                      {resourceLabel(log)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
