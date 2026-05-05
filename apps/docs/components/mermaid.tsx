'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ZoomInAreaIcon, ZoomOutAreaIcon, ArrowExpand01Icon } from '@hugeicons/core-free-icons';

let counter = 0;

function isDarkMode() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function Mermaid({ chart }: { chart: string }) {
  const id = useMemo(() => `mermaid-${++counter}`, []);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setDark(isDarkMode());
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setSvg('');
      setError('');

      const mermaid = (await import('mermaid')).default;

      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'neutral',
        fontFamily: 'inherit',
        securityLevel: 'loose',
      });

      try {
        const { svg: output } = await mermaid.render(id, chart);
        if (!cancelled) setSvg(output);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, dark, id]);

  if (error) {
    return (
      <pre
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          background: 'var(--color-fd-muted, #fef2f2)',
          color: '#ef4444',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        Mermaid error: {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          fontSize: '14px',
          color: 'var(--color-fd-muted-foreground, #9ca3af)',
        }}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Click to expand diagram"
        onClick={() => setDialogOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setDialogOpen(true)}
        style={{
          margin: '20px 0',
          borderRadius: '10px',
          border: '1px solid var(--color-fd-border, #e2e8f0)',
          overflowX: 'auto',
          textAlign: 'center',
          cursor: 'zoom-in',
          position: 'relative',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {dialogOpen && (
        <MermaidZoomDialog svg={svg} onClose={() => setDialogOpen(false)} />
      )}
    </>
  );
}

function MermaidZoomDialog({ svg, onClose }: { svg: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((s) => Math.min(5, Math.max(0.2, s * (1 - e.deltaY * 0.001))));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setAttribute('data-dragging', 'true');
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan((p) => ({
      x: p.x + (e.clientX - lastPos.current.x),
      y: p.y + (e.clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    dragging.current = false;
    e.currentTarget.removeAttribute('data-dragging');
  }, []);

  const zoomIn = () => setScale((s) => Math.min(5, s * 1.25));
  const zoomOut = () => setScale((s) => Math.max(0.2, s / 1.25));
  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 8,
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={zoomOut}
          aria-label="Zoom out"
          style={controlButtonStyle}
        >
          <HugeiconsIcon icon={ZoomOutAreaIcon} strokeWidth={2} size={18} />
        </button>
        <button
          onClick={zoomIn}
          aria-label="Zoom in"
          style={controlButtonStyle}
        >
          <HugeiconsIcon icon={ZoomInAreaIcon} strokeWidth={2} size={18} />
        </button>
        <button
          onClick={reset}
          aria-label="Reset view"
          style={controlButtonStyle}
        >
          <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} size={18} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ ...controlButtonStyle, marginLeft: 8 }}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} size={18} />
        </button>
      </div>

      {/* Diagram canvas */}
      <div
        ref={containerRef}
        style={{
          width: '90vw',
          height: '90vh',
          overflow: 'hidden',
          cursor: 'grab',
          userSelect: 'none',
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
            transformOrigin: 'center',
            position: 'absolute',
            top: '50%',
            left: '50%',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 12,
          pointerEvents: 'none',
        }}
      >
        Scroll to zoom · Drag to pan · Esc to close
      </div>
    </div>
  );
}

const controlButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.1)',
  color: 'white',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
};
