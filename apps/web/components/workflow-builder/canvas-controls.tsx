import { Panel, useReactFlow } from '@xyflow/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cursor01Icon, HandGrabIcon,
  Add01Icon, MinusSignIcon, FitToScreenIcon, Mouse01Icon, LockKeyIcon,
} from '@hugeicons/core-free-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@linea/ui/components/tooltip';
import { Kbd } from '@linea/ui/components/kbd';

export function CanvasControls({
  cursorMode,
  setCursorMode,
  isInteractive,
  onInteractiveToggle,
}: {
  cursorMode: 'select' | 'grab';
  setCursorMode: (m: 'select' | 'grab') => void;
  isInteractive: boolean;
  onInteractiveToggle: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  type CtrlBtn = { icon: typeof Add01Icon; label: string; shortcut?: string; action: () => void; active?: boolean };
  const sections: Array<CtrlBtn[] | null> = [
    [
      { icon: HandGrabIcon,  label: 'Pan mode',    shortcut: 'G', action: () => setCursorMode('grab'),   active: cursorMode === 'grab'   },
      { icon: Cursor01Icon,  label: 'Select mode', shortcut: 'V', action: () => setCursorMode('select'), active: cursorMode === 'select' },
    ],
    null,
    [
      { icon: Add01Icon,       label: 'Zoom in',  action: () => zoomIn({ duration: 200 })  },
      { icon: MinusSignIcon,   label: 'Zoom out', action: () => zoomOut({ duration: 200 }) },
      { icon: FitToScreenIcon, label: 'Fit view', shortcut: 'F', action: () => fitView({ padding: 0.25, duration: 300 }) },
    ],
    null,
    [
      {
        icon: isInteractive ? Mouse01Icon : LockKeyIcon,
        label: isInteractive ? 'Lock canvas' : 'Unlock canvas',
        action: onInteractiveToggle,
        active: !isInteractive,
      },
    ],
  ];

  return (
    <Panel position="bottom-left" className="!m-2">
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-md backdrop-blur-sm">
        {sections.map((section, si) =>
            section === null ? (
              <div key={si} className="mx-1.5 h-px bg-border" />
            ) : (
              section.map((btn, bi) => (
                <Tooltip key={`${si}-${bi}`}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={btn.action}
                      className={`flex size-8 items-center justify-center transition-colors ${
                        btn.active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <HugeiconsIcon icon={btn.icon} className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="flex items-center gap-2">
                    {btn.label}
                    {btn.shortcut && <Kbd>{btn.shortcut}</Kbd>}
                  </TooltipContent>
                </Tooltip>
              ))
            ),
          )}
        </div>
    </Panel>
  );
}
