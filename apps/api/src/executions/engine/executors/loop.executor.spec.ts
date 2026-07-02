import {
  executeLoopNode,
  checkLoopTimeout,
  MAX_LOOP_TIMEOUT_MS,
} from './loop.executor';
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
    const result = executeLoopNode(
      { arrayPath: 'single' },
      state({ single: 'hello' }),
    );
    expect(result.results).toEqual(['hello']);
  });

  it('returns empty when no arrayPath is given', () => {
    const result = executeLoopNode({}, state({ items: [1, 2] }));
    expect(result.results).toEqual([]);
  });

  describe('wall-clock timeout guard (LIN-30)', () => {
    afterEach(() => jest.restoreAllMocks());

    it('throws with correct message when elapsed time exceeds MAX_LOOP_TIMEOUT_MS', () => {
      let calls = 0;
      jest
        .spyOn(Date, 'now')
        .mockImplementation(() =>
          calls++ === 0 ? 0 : MAX_LOOP_TIMEOUT_MS + 1,
        );
      const startMs = Date.now();
      expect(() => checkLoopTimeout(startMs, 0)).toThrow(
        /Loop exceeded maximum duration of 5 minutes after 0 iterations/,
      );
    });

    it('does not throw before the timeout is reached', () => {
      jest.spyOn(Date, 'now').mockReturnValue(0);
      expect(() => checkLoopTimeout(0, 5)).not.toThrow();
    });
  });

  describe('structured output shape (LIN-29)', () => {
    it('always returns results, total, and items keys', () => {
      const result = executeLoopNode(
        { arrayPath: 'list' },
        state({ list: ['a', 'b', 'c'] }),
      );
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('items');
    });

    it('items preserves the original array unchanged', () => {
      const original = [{ id: 1 }, { id: 2 }];
      const result = executeLoopNode(
        { arrayPath: 'rows', itemTransform: 'item.id' },
        state({ rows: original }),
      );
      expect(result.items).toEqual(original);
      expect(result.results).toEqual([1, 2]);
    });

    it('total equals results.length', () => {
      const result = executeLoopNode(
        { arrayPath: 'nums' },
        state({ nums: [10, 20, 30] }),
      );
      expect(result.total).toBe(result.results.length);
      expect(result.total).toBe(3);
    });

    it('items is capped at maxIterations but results matches items length', () => {
      const nums = Array.from({ length: 10 }, (_, i) => i);
      const result = executeLoopNode(
        { arrayPath: 'nums', maxIterations: 4 },
        state({ nums }),
      );
      expect(result.items).toHaveLength(4);
      expect(result.results).toHaveLength(4);
      expect(result.total).toBe(4);
    });
  });
});
