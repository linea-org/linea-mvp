'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { formatRelativeTime } from '@/lib/format';
import type { Session } from './types';

export function HistorySidebar({ sessions, currentId, onLoad, onNew, onDelete }: {
  sessions: Session[];
  currentId: string;
  onLoad: (s: Session) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const grouped: { label: string; items: Session[] }[] = [];
  const now = Date.now();
  const today: Session[] = [], week: Session[] = [], older: Session[] = [];
  for (const s of sessions) {
    const age = now - s.createdAt;
    if (age < 86_400_000) today.push(s);
    else if (age < 7 * 86_400_000) week.push(s);
    else older.push(s);
  }
  if (today.length) grouped.push({ label: 'Today', items: today });
  if (week.length)  grouped.push({ label: 'This week', items: week });
  if (older.length) grouped.push({ label: 'Older', items: older });

  return (
    <div className="flex h-full flex-col bg-muted/30 border-r border-border">
      <div className="p-3 border-b border-border shrink-0">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5 text-muted-foreground" />
          New conversation
        </button>
      </div>
      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">No past conversations yet.</p>
        ) : (
          <div className="py-2">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
                {group.items.map((s) => (
                  <div key={s.id} className={`group relative flex items-center rounded-md mx-2 mb-0.5 ${s.id === currentId ? 'bg-muted' : 'hover:bg-muted/60'} transition-colors`}>
                    <button
                      onClick={() => onLoad(s)}
                      className="flex-1 min-w-0 px-2 py-2 text-left"
                    >
                      <p className={`text-xs font-medium truncate ${s.id === currentId ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {s.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatRelativeTime(s.createdAt)}</p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                      className="shrink-0 mr-1 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
