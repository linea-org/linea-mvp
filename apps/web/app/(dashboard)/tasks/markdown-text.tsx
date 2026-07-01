'use client';

import type { ReactNode } from 'react';

export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith('```')) { codeLines.push(lines[i] ?? ''); i++; }
      elements.push(<pre key={i} className="my-2 overflow-x-auto rounded-lg bg-muted px-4 py-3 text-xs font-mono border border-border text-foreground">{codeLines.join('\n')}</pre>);
      i++; continue;
    }
    const h3 = line.match(/^###\s+(.*)/); const h2 = line.match(/^##\s+(.*)/); const h1 = line.match(/^#\s+(.*)/);
    if (h1) { elements.push(<p key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{h1[1]}</p>); i++; continue; }
    if (h2) { elements.push(<p key={i} className="mt-3 mb-1 text-sm font-bold text-foreground">{h2[1]}</p>); i++; continue; }
    if (h3) { elements.push(<p key={i} className="mt-2 mb-0.5 text-sm font-semibold text-foreground">{h3[1]}</p>); i++; continue; }
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) { elements.push(<li key={i} className="ml-4 text-sm list-disc marker:text-muted-foreground"><InlineText text={bullet[1] ?? ''} /></li>); i++; continue; }
    const num = line.match(/^\d+\.\s+(.*)/);
    if (num) { elements.push(<li key={i} className="ml-4 text-sm list-decimal marker:text-muted-foreground"><InlineText text={num[1] ?? ''} /></li>); i++; continue; }
    if (line.trim()) elements.push(<p key={i} className="text-sm leading-relaxed"><InlineText text={line} /></p>);
    else if (elements.length > 0) elements.push(<div key={i} className="h-1.5" />);
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}
