import type { Operator, SourceCategory } from './evals-panel.types';

export const OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'equals',
  contains: 'contains',
  exists: 'exists',
  not_exists: 'not exists',
  gt: 'greater than',
  lt: 'less than',
  llm_judge: 'LLM judge',
  tool_called: 'was called',
  tool_not_called: 'was NOT called',
  semantic_match: 'semantic match',
};

export const NEEDS_EXPECTED = new Set<Operator>(['equals', 'contains', 'gt', 'lt']);

export function getSourceCategory(source: string | undefined): SourceCategory {
  if (!source || source === 'output') return 'output';
  if (source.startsWith('node:')) return 'node';
  if (source === 'tool_calls' || source.startsWith('tool_calls:')) return 'tool_calls';
  return 'metric';
}

export const OPERATORS_FOR_SOURCE: Record<SourceCategory, Operator[]> = {
  output: ['equals', 'contains', 'exists', 'not_exists', 'gt', 'lt', 'llm_judge', 'semantic_match'],
  node: ['equals', 'contains', 'exists', 'not_exists', 'gt', 'lt', 'llm_judge', 'semantic_match'],
  metric: ['equals', 'gt', 'lt'],
  tool_calls: ['tool_called', 'tool_not_called'],
};
