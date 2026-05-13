import { executeLoopNode } from './loop.executor';
import type { WorkflowState } from '../variable-substitution';

function state(variables: Record<string, any>): WorkflowState {
  return { variables, chatHistory: [] };
}

describe('executeLoopNode', () => {
  it('returns the array as-is when no transform is given', () => {
    const result = executeLoopNode(
      { arrayPath: 'items' },
      state({ items: [1, 2, 3] }),
    );
    expect(result.results).toEqual([1, 2, 3]);
    expect(result.total).toBe(3);
    expect(result.items).toEqual([1, 2, 3]);
  });

  it('resolves {{variable}} syntax in arrayPath', () => {
    const result = executeLoopNode(
      { arrayPath: '{{numbers}}' },
      state({ numbers: [10, 20] }),
    );
    expect(result.results).toEqual([10, 20]);
  });

  it('resolves a dot-path into nested variable', () => {
    const result = executeLoopNode(
      { arrayPath: 'data.items' },
      state({ data: { items: ['a', 'b'] } }),
    );
    expect(result.results).toEqual(['a', 'b']);
  });

  it('applies item transform expression', () => {
    const result = executeLoopNode(
      { arrayPath: 'nums', itemTransform: 'item * 2' },
      state({ nums: [1, 2, 3] }),
    );
    expect(result.results).toEqual([2, 4, 6]);
  });

  it('applies property access transform', () => {
    const result = executeLoopNode(
      { arrayPath: 'users', itemTransform: 'item.name' },
      state({ users: [{ name: 'Alice' }, { name: 'Bob' }] }),
    );
    expect(result.results).toEqual(['Alice', 'Bob']);
  });

  it('falls back to item on transform error', () => {
    const result = executeLoopNode(
      { arrayPath: 'items', itemTransform: 'item.nonexistent.crash()' },
      state({ items: [1] }),
    );
    // Falls back to original item without throwing
    expect(result.results).toEqual([1]);
  });

  it('caps results at maxIterations', () => {
    const items = Array.from({ length: 200 }, (_, i) => i);
    const result = executeLoopNode(
      { arrayPath: 'items', maxIterations: 50 },
      state({ items }),
    );
    expect(result.total).toBe(50);
  });

  it('returns empty when arrayPath is not found', () => {
    const result = executeLoopNode({ arrayPath: 'missing' }, state({}));
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('wraps a non-array scalar in a one-element array', () => {
    const result = executeLoopNode({ arrayPath: 'single' }, state({ single: 'hello' }));
    expect(result.results).toEqual(['hello']);
  });

  it('returns empty when no arrayPath is given', () => {
    const result = executeLoopNode({}, state({ items: [1, 2] }));
    expect(result.results).toEqual([]);
  });
});
