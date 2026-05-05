'use client';

import { useMemo, useState } from 'react';
import type { GitHubIssue, GitHubMilestone } from '@/lib/github';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@linea/ui/components/card';
import { Progress } from '@linea/ui/components/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@linea/ui/components/table';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@linea/ui/components/empty';
import { cn } from '@linea/ui/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  CircleIcon,
  Loading03Icon,
  Flag01Icon,
  KanbanIcon,
  LayoutTable01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';

// ── types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'milestone' | 'kanban' | 'table';
type SortField = 'default' | 'number' | 'status' | 'updated';
type SortDir = 'asc' | 'desc';

// ── view config ───────────────────────────────────────────────────────────────

const VIEWS: { id: ViewMode; label: string; icon: typeof Flag01Icon }[] = [
  { id: 'milestone', label: 'Milestones', icon: Flag01Icon },
  { id: 'kanban', label: 'Kanban', icon: KanbanIcon },
  { id: 'table', label: 'Table', icon: LayoutTable01Icon },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'default', label: 'Default order' },
  { value: 'number', label: 'Issue number' },
  { value: 'status', label: 'Status' },
  { value: 'updated', label: 'Recently updated' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function isInProgress(issue: GitHubIssue) {
  return issue.labels.some(
    (l) => l.name.toLowerCase() === 'in progress' || l.name.toLowerCase() === 'wip',
  );
}

function labelTextColor(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000' : '#fff';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── shared sub-components ─────────────────────────────────────────────────────

function IssueStateIcon({ issue }: { issue: GitHubIssue }) {
  if (issue.state === 'closed')
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle01Icon}
        strokeWidth={2}
        className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400"
      />
    );
  if (isInProgress(issue))
    return (
      <HugeiconsIcon
        icon={Loading03Icon}
        strokeWidth={2}
        className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400"
      />
    );
  return (
    <HugeiconsIcon
      icon={CircleIcon}
      strokeWidth={2}
      className="size-3.5 shrink-0 text-muted-foreground"
    />
  );
}

function IssueBadge({ issue }: { issue: GitHubIssue }) {
  if (issue.state === 'closed')
    return (
      <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        Done
      </Badge>
    );
  if (isInProgress(issue))
    return (
      <Badge className="border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400">
        In Progress
      </Badge>
    );
  return <Badge variant="secondary">Open</Badge>;
}

function LabelChips({ issue }: { issue: GitHubIssue }) {
  const filtered = issue.labels.filter(
    (l) => l.name.toLowerCase() !== 'in progress' && l.name.toLowerCase() !== 'wip',
  );
  return (
    <>
      {filtered.map((l) => (
        <span
          key={l.name}
          className="inline-flex items-center rounded-full px-1.5 py-px text-[0.625rem] font-medium leading-none"
          style={{ background: `#${l.color}`, color: labelTextColor(l.color) }}
        >
          {l.name}
        </span>
      ))}
    </>
  );
}

// ── milestone view ────────────────────────────────────────────────────────────

function MilestoneProgressBar({ closed, total }: { closed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((closed / total) * 100);
  return (
    <div className="mt-2 space-y-1">
      <Progress
        value={pct}
        className={cn(pct === 100 && '[&>[data-slot=progress-indicator]]:bg-emerald-500')}
      />
      <span className="text-xs text-muted-foreground">
        {closed}/{total} closed · {pct}%
      </span>
    </div>
  );
}

function MilestoneCard({ milestone, issues }: { milestone: GitHubMilestone; issues: GitHubIssue[] }) {
  const total = milestone.open_issues + milestone.closed_issues;
  return (
    <Card className="mb-3">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <a
            href={milestone.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="roadmap-issue-link hover:text-primary transition-colors"
          >
            {milestone.title}
          </a>
          {milestone.state === 'closed' ? (
            <Badge variant="outline">Completed</Badge>
          ) : (
            <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              Active
            </Badge>
          )}
          {milestone.due_on && (
            <span className="text-xs font-normal text-muted-foreground">
              Due{' '}
              {new Date(milestone.due_on).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </CardTitle>
        {milestone.description && <CardDescription>{milestone.description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-3">
        <MilestoneProgressBar closed={milestone.closed_issues} total={total} />
        {issues.length > 0 && (
          <div className="mt-3 divide-y divide-border">
            {issues.map((issue) => (
              <IssueRowCompact key={issue.id} issue={issue} />
            ))}
          </div>
        )}
        {issues.length === 0 && total === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No issues assigned yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function IssueRowCompact({ issue }: { issue: GitHubIssue }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="mt-px shrink-0">
        <IssueStateIcon issue={issue} />
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={issue.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="roadmap-issue-link text-xs font-medium text-foreground hover:text-primary transition-colors"
        >
          #{issue.number} {issue.title}
        </a>
        <div className="mt-1 flex flex-wrap gap-1">
          <LabelChips issue={issue} />
        </div>
      </div>
      <IssueBadge issue={issue} />
    </div>
  );
}

// ── kanban view ───────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    id: 'planned',
    label: 'Planned',
    color: '#6366f1',
    filter: (i: GitHubIssue) => i.state === 'open' && !isInProgress(i),
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    color: '#f59e0b',
    filter: (i: GitHubIssue) => i.state === 'open' && isInProgress(i),
  },
  {
    id: 'done',
    label: 'Done',
    color: '#10b981',
    filter: (i: GitHubIssue) => i.state === 'closed',
  },
] as const;

function KanbanCard({ issue }: { issue: GitHubIssue }) {
  return (
    <a
      href={issue.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-2 block no-underline"
    >
      <Card
        className="cursor-pointer transition-all hover:ring-primary/30"
        size="sm"
      >
        <CardContent className="space-y-1.5 pb-2 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IssueStateIcon issue={issue} />
            <span>#{issue.number}</span>
            {issue.milestone && (
              <span className="truncate italic">{issue.milestone.title}</span>
            )}
          </div>
          <div className="text-xs font-medium leading-snug text-foreground">
            {issue.title}
          </div>
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <LabelChips issue={issue} />
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">
            updated {formatDate(issue.updated_at)}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function KanbanView({ issues }: { issues: GitHubIssue[] }) {
  return (
    <div className="grid grid-cols-3 items-start gap-4">
      {COLUMNS.map((col) => {
        const colIssues = issues.filter(col.filter);
        return (
          <div key={col.id}>
            <div
              className="mb-2.5 flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: `${col.color}1a`, borderLeft: `3px solid ${col.color}` }}
            >
              <span className="text-xs font-semibold" style={{ color: col.color }}>
                {col.label}
              </span>
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-bold text-white"
                style={{ background: col.color }}
              >
                {colIssues.length}
              </span>
            </div>
            {colIssues.length === 0 ? (
              <Empty className="border py-5">
                <span className="text-xs text-muted-foreground">No issues</span>
              </Empty>
            ) : (
              colIssues.map((issue) => <KanbanCard key={issue.id} issue={issue} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── table view ────────────────────────────────────────────────────────────────

function TableView({ issues }: { issues: GitHubIssue[] }) {
  if (issues.length === 0) {
    return (
      <Empty className="border py-8">
        <EmptyHeader>
          <EmptyTitle>No issues found</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {['#', 'Title', 'Milestone', 'Labels', 'Status', 'Updated'].map((h) => (
            <TableHead key={h} className="text-muted-foreground">
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.id}>
            <TableCell className="text-muted-foreground">
              <a
                href={issue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="roadmap-issue-link hover:text-foreground transition-colors"
              >
                #{issue.number}
              </a>
            </TableCell>
            <TableCell className="max-w-xs whitespace-normal">
              <a
                href={issue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="roadmap-issue-link font-medium text-foreground hover:text-primary transition-colors"
              >
                {issue.title}
              </a>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {issue.milestone?.title ?? <span className="opacity-40">—</span>}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <LabelChips issue={issue} />
              </div>
            </TableCell>
            <TableCell>
              <IssueBadge issue={issue} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(issue.updated_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function RoadmapView({
  milestones,
  issues,
  repoUrl,
}: {
  milestones: GitHubMilestone[];
  issues: GitHubIssue[];
  repoUrl: string;
}) {
  const [view, setView] = useState<ViewMode>('milestone');
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const noData = milestones.length === 0 && issues.length === 0;

  const byMilestone = useMemo(() => {
    const map = new Map<number, GitHubIssue[]>();
    for (const issue of issues) {
      if (issue.milestone) {
        const arr = map.get(issue.milestone.number) ?? [];
        arr.push(issue);
        map.set(issue.milestone.number, arr);
      }
    }
    return map;
  }, [issues]);

  const sortedMilestones = useMemo(() => {
    const arr = [...milestones];
    if (sortField === 'number') {
      arr.sort((a, b) => {
        const cmp = a.number - b.number;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else if (sortField === 'status') {
      arr.sort((a, b) => {
        const cmp = a.state === b.state ? 0 : a.state === 'open' ? -1 : 1;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      arr.sort((a, b) => {
        if (a.state !== b.state) return a.state === 'open' ? -1 : 1;
        if (!a.due_on && !b.due_on) return a.number - b.number;
        if (!a.due_on) return 1;
        if (!b.due_on) return -1;
        const cmp = new Date(a.due_on).getTime() - new Date(b.due_on).getTime();
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return arr;
  }, [milestones, sortField, sortDir]);

  const sortedIssues = useMemo(() => {
    const arr = [...issues];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'number') {
        cmp = a.number - b.number;
      } else if (sortField === 'status') {
        const rank = (i: GitHubIssue) => (i.state === 'closed' ? 2 : isInProgress(i) ? 1 : 0);
        cmp = rank(a) - rank(b);
      } else if (sortField === 'updated') {
        cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      } else {
        cmp = a.number - b.number;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [issues, sortField, sortDir]);

  const backlog = useMemo(
    () => sortedIssues.filter((i) => i.state === 'open' && !i.milestone),
    [sortedIssues],
  );

  const openCount = issues.filter((i) => i.state === 'open').length;
  const closedCount = issues.filter((i) => i.state === 'closed').length;

  if (noData) {
    return (
      <Empty className="border py-10">
        <EmptyHeader>
          <EmptyTitle>Could not load GitHub data</EmptyTitle>
          <EmptyDescription>
            Set <code className="rounded bg-muted px-1 py-px font-mono text-foreground">GITHUB_TOKEN</code> in{' '}
            <code className="rounded bg-muted px-1 py-px font-mono text-foreground">.env.local</code>{' '}
            or{' '}
            <a href={`${repoUrl}/milestones`} target="_blank" rel="noopener noreferrer">
              view on GitHub ↗
            </a>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          { label: 'Open milestones', value: milestones.filter((m) => m.state === 'open').length },
          { label: 'Open issues', value: openCount },
          { label: 'Closed issues', value: closedCount },
        ].map(({ label, value }) => (
          <Card key={label} className="min-w-[110px] flex-1" size="sm">
            <CardContent className="pb-3 pt-3">
              <div className="text-2xl font-bold text-foreground">{value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3.5 py-2.5">
        <div className="flex h-8 items-center gap-1">
          {VIEWS.map(({ id, label, icon }) => (
            <Button
              key={id}
              size="sm"
              variant={view === id ? 'default' : 'ghost'}
              className="h-8 gap-2 px-3 text-xs font-medium leading-8"
              onClick={() => setView(id)}
            >
              <HugeiconsIcon icon={icon} strokeWidth={2} className="!size-3.5 shrink-0" />
              <span className="inline-block leading-8">{label}</span>
            </Button>
          ))}
        </div>
        <div className="min-w-0 flex-1" aria-hidden="true" />
        <div className="flex h-8 shrink-0 items-center gap-2">
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger
              size="sm"
              aria-label="Sort issues"
              className="h-8 min-h-8 justify-between gap-2 py-0 pl-3 pr-2.5 text-xs font-medium leading-none shadow-none data-[size=sm]:h-8 *:data-[slot=select-value]:min-h-0 *:data-[slot=select-value]:leading-none *:data-[slot=select-value]:gap-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs bg-white dark:bg-black">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="size-8 shrink-0"
            size="icon-sm"
            variant="outline"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            <HugeiconsIcon
              icon={sortDir === 'asc' ? ArrowUp01Icon : ArrowDown01Icon}
              strokeWidth={2}
              className="!size-3.5"
            />
          </Button>
        </div>
      </div>

      {view === 'milestone' && (
        <>
          {sortedMilestones.map((m) => (
            <MilestoneCard key={m.id} milestone={m} issues={byMilestone.get(m.number) ?? []} />
          ))}
          {backlog.length > 0 && (
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle>Backlog</CardTitle>
                <CardDescription>Open issues not yet assigned to a milestone</CardDescription>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="divide-y divide-border">
                  {backlog.map((issue) => (
                    <IssueRowCompact key={issue.id} issue={issue} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {view === 'kanban' && <KanbanView issues={sortedIssues} />}

      {view === 'table' && <TableView issues={sortedIssues} />}

      <p className="mt-4 text-xs text-muted-foreground">
        Synced from{' '}
        <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="roadmap-issue-link hover:text-foreground transition-colors">
          GitHub
        </a>{' '}
        · refreshes every hour
      </p>
    </div>
  );
}
