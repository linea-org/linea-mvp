'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@linea/ui/components/dialog';
import { Kbd, KbdGroup } from '@linea/ui/components/kbd';

interface ShortcutRow {
  keys: string[][];
  description: string;
}

interface ShortcutSection {
  heading: string;
  rows: ShortcutRow[];
}

const SECTIONS: ShortcutSection[] = [
  {
    heading: 'Global',
    rows: [
      { keys: [['⌘', 'K'], ['Ctrl', 'K']], description: 'Open command palette' },
      { keys: [['?']], description: 'Show keyboard shortcuts' },
      { keys: [['Esc']], description: 'Close dialog / cancel' },
    ],
  },
  {
    heading: 'Navigate',
    rows: [
      { keys: [['G', 'W']], description: 'Go to Workflows' },
      { keys: [['G', 'E']], description: 'Go to Executions' },
      { keys: [['G', 'S']], description: 'Go to Schedules' },
      { keys: [['G', 'K']], description: 'Go to Knowledge' },
      { keys: [['G', 'T']], description: 'Go to Templates' },
      { keys: [['G', 'M']], description: 'Go to Metrics' },
    ],
  },
  {
    heading: 'Workflow builder',
    rows: [
      { keys: [['⌘', 'S'], ['Ctrl', 'S']], description: 'Save workflow' },
      { keys: [['⌘', '↵'], ['Ctrl', '↵']], description: 'Run workflow' },
      { keys: [['⌘', 'Z'], ['Ctrl', 'Z']], description: 'Undo' },
      { keys: [['⌘', '⇧', 'Z'], ['Ctrl', 'Y']], description: 'Redo' },
      { keys: [['⌘', 'G'], ['Ctrl', 'G']], description: 'Open AI Generate' },
      { keys: [['⌘', 'L'], ['Ctrl', 'L']], description: 'Auto layout' },
      { keys: [['⌘', "'"], ['Ctrl', "'"]], description: 'Toggle comments' },
      { keys: [['F']], description: 'Fit canvas to view' },
      { keys: [['G']], description: 'Pan / grab mode' },
      { keys: [['V']], description: 'Select mode' },
      { keys: [['A']], description: 'Auto layout' },
      { keys: [['Del'], ['⌫']], description: 'Delete selected node' },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      if (e.type === 'linea:open-shortcuts') setOpen(true);
    }
    window.addEventListener('linea:open-shortcuts', handler);
    return () => window.removeEventListener('linea:open-shortcuts', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.rows.map((row) => (
                  <div
                    key={row.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{row.description}</span>
                    <div className="flex items-center gap-1.5">
                      {row.keys.map((combo, ci) => (
                        <span key={ci} className="flex items-center gap-1">
                          {ci > 0 && (
                            <span className="text-[10px] text-muted-foreground">or</span>
                          )}
                          <KbdGroup>
                            {combo.map((k) => (
                              <Kbd key={k}>{k}</Kbd>
                            ))}
                          </KbdGroup>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
