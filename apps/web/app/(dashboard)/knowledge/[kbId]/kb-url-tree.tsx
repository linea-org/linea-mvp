'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowRight01Icon, Tick01Icon } from '@hugeicons/core-free-icons';

export interface UrlNode {
  label: string;
  fullPath: string;
  urls: string[];
  children: UrlNode[];
}

export function buildUrlTree(urls: string[]): UrlNode {
  const root: UrlNode = { label: '/', fullPath: '', urls: [], children: [] };
  for (const url of urls) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { continue; }
    const parts = parsed.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const fp = '/' + parts.slice(0, i + 1).join('/');
      let child = node.children.find((c) => c.label === part);
      if (!child) {
        child = { label: part, fullPath: fp, urls: [], children: [] };
        node.children.push(child);
      }
      node = child;
    }
    if (!node.urls.includes(url)) node.urls.push(url);
  }
  return root;
}

export function collectUrls(node: UrlNode): string[] {
  return [...node.urls, ...node.children.flatMap(collectUrls)];
}

function nodeSelectionState(node: UrlNode, selected: Set<string>): 'all' | 'some' | 'none' {
  const all = collectUrls(node);
  if (all.length === 0) return 'none';
  const cnt = all.filter((u) => selected.has(u)).length;
  if (cnt === 0) return 'none';
  if (cnt === all.length) return 'all';
  return 'some';
}

export function UrlTreeNode({
  node,
  selected,
  collapsed,
  onToggleSelect,
  onToggleCollapse,
  depth,
}: {
  node: UrlNode;
  selected: Set<string>;
  collapsed: Set<string>;
  onToggleSelect: (node: UrlNode) => void;
  onToggleCollapse: (path: string) => void;
  depth: number;
}) {
  const state = nodeSelectionState(node, selected);
  const isCollapsed = collapsed.has(node.fullPath);
  const hasChildren = node.children.length > 0;
  const totalUrls = collectUrls(node).length;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-muted/40 transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          onClick={() => hasChildren && onToggleCollapse(node.fullPath)}
          className={`shrink-0 size-4 flex items-center justify-center rounded text-muted-foreground transition-colors ${hasChildren ? 'hover:text-foreground' : 'opacity-0 pointer-events-none'}`}
        >
          <HugeiconsIcon icon={isCollapsed ? ArrowRight01Icon : ArrowDown01Icon} className="size-3" />
        </button>
        <button
          onClick={() => onToggleSelect(node)}
          className={`shrink-0 size-4 rounded flex items-center justify-center border transition-colors ${
            state === 'all'
              ? 'bg-primary border-primary text-primary-foreground'
              : state === 'some'
                ? 'bg-primary/30 border-primary/60'
                : 'border-border hover:border-muted-foreground'
          }`}
        >
          {state === 'all' && <HugeiconsIcon icon={Tick01Icon} className="size-2.5" />}
          {state === 'some' && <span className="size-1.5 rounded-full bg-primary block" />}
        </button>
        <span className="flex-1 min-w-0 text-[11px] font-mono truncate text-foreground" title={node.fullPath || '/'}>
          {node.label}
        </span>
        {totalUrls > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground font-mono opacity-60">
            {totalUrls}
          </span>
        )}
      </div>
      {!isCollapsed && hasChildren && (
        <div>
          {node.children.map((child) => (
            <UrlTreeNode
              key={child.fullPath}
              node={child}
              selected={selected}
              collapsed={collapsed}
              onToggleSelect={onToggleSelect}
              onToggleCollapse={onToggleCollapse}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
