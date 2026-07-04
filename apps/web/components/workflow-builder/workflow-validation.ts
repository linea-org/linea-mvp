import type { Node, Edge } from '@xyflow/react';
import type { ValidationState } from './toolbar';

export const NODE_COLORS: Record<string, string> = {
  start: '#6366f1', end: '#14b8a6', agent: '#3b82f6',
  http: '#8b5cf6', transform: '#7c3aed', 'if-else': '#f59e0b',
  router: '#ea580c', approval: '#f97316', 'approval-gate': '#f97316', mcp: '#eab308', memory: '#a855f7',
  extract: '#0ea5e9', retriever: '#10b981', guardrails: '#ef4444', code: '#64748b',
  loop: '#0891b2', parallel: '#6366f1', wait: '#64748b', variables: '#059669',
  evaluator: '#d97706', subworkflow: '#7c3aed',
  slack: '#4a154b', github: '#1f2328', notion: '#37352f', gmail: '#ea4335',
  filter: '#06b6d4', merge: '#8b5cf6', datetime: '#0d9488',
};

export const QUICK_NODE_TYPES: { type: string; label: string }[] = [
  { type: 'agent',     label: 'Agent'     },
  { type: 'http',      label: 'HTTP'      },
  { type: 'transform', label: 'Transform' },
  { type: 'if-else',   label: 'If / Else' },
  { type: 'router',    label: 'Router'    },
  { type: 'code',      label: 'Code'      },
  { type: 'loop',      label: 'Loop'      },
  { type: 'variables', label: 'Variables' },
];

export function getValidationState(nodes: Node[], edges: Edge[]): ValidationState {
  const issues: string[] = [];
  let level: ValidationState['level'] = 'success';

  const hasStart = nodes.some((n) => n.type === 'start');
  const actionNodes = nodes.filter((n) => n.type !== 'start' && n.type !== 'end');

  // Hard errors — block run
  if (!hasStart) {
    issues.push('Missing Start node');
    level = 'error';
  }
  if (nodes.length > 0 && actionNodes.length === 0) {
    issues.push('Add at least one action node (Agent, HTTP, etc.)');
    level = 'error';
  }

  if (level !== 'error') {
    // Start has no outgoing edge
    const startNode = nodes.find((n) => n.type === 'start');
    if (startNode && actionNodes.length > 0 && !edges.some((e) => e.source === startNode.id)) {
      issues.push('Start node is not connected to anything');
      level = 'warning';
    }

    // Floating action nodes
    const connectedIds = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
    const floating = actionNodes.filter((n) => !connectedIds.has(n.id));
    if (floating.length > 0) {
      const label = floating.length === 1
        ? `"${(floating[0]!.data?.nodeName as string) ?? floating[0]!.type}" is not connected`
        : `${floating.length} nodes are not connected`;
      issues.push(label);
      if (level === 'success') level = 'warning';
    }

    // if-else nodes need both true/false outputs wired
    const ifElseNodes = nodes.filter((n) => n.type === 'if-else');
    for (const bn of ifElseNodes) {
      const hasTrue  = edges.some((e) => e.source === bn.id && e.sourceHandle === 'true');
      const hasFalse = edges.some((e) => e.source === bn.id && e.sourceHandle === 'false');
      if (!hasTrue || !hasFalse) {
        const name = (bn.data?.nodeName as string) ?? bn.type;
        const missing = !hasTrue && !hasFalse ? 'True & False branches' : !hasTrue ? 'True branch' : 'False branch';
        issues.push(`"${name}" missing ${missing}`);
        if (level === 'success') level = 'warning';
      }
    }

    // router nodes need at least one route wired
    const routerNodes = nodes.filter((n) => n.type === 'router');
    for (const rn of routerNodes) {
      const hasAnyRoute = edges.some((e) => e.source === rn.id);
      if (!hasAnyRoute) {
        const name = (rn.data?.nodeName as string) ?? 'Router';
        issues.push(`"${name}" has no routes connected`);
        if (level === 'success') level = 'warning';
      }
    }
  }

  return { level, issues };
}
