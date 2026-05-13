import { substituteVariables, substituteInValue } from './variable-substitution';
import type { WorkflowState } from './variable-substitution';

function makeState(variables: Record<string, any>): WorkflowState {
  return { variables, chatHistory: [] };
}

describe('substituteVariables', () => {
  it('replaces a simple top-level variable', () => {
    const state = makeState({ name: 'Alice' });
    expect(substituteVariables('Hello {{name}}!', state)).toBe('Hello Alice!');
  });

  it('replaces multiple variables in one string', () => {
    const state = makeState({ a: 'foo', b: 'bar' });
    expect(substituteVariables('{{a}} and {{b}}', state)).toBe('foo and bar');
  });

  it('leaves unknown variable references untouched', () => {
    const state = makeState({});
    expect(substituteVariables('value: {{missing}}', state)).toBe('value: {{missing}}');
  });

  it('returns empty string unchanged', () => {
    expect(substituteVariables('', makeState({}))).toBe('');
  });

  it('serialises objects to JSON', () => {
    const state = makeState({ obj: { x: 1 } });
    expect(substituteVariables('{{obj}}', state)).toBe('{"x":1}');
  });

  it('resolves dot-path into nested variable', () => {
    const state = makeState({ start: { city: 'London' } });
    expect(substituteVariables('{{start.city}}', state)).toBe('London');
  });

  it('resolves array index access', () => {
    const state = makeState({ items: ['alpha', 'beta'] });
    expect(substituteVariables('{{items[1]}}', state)).toBe('beta');
  });

  it('resolves state.variables. prefix explicitly', () => {
    const state = makeState({ score: 42 });
    expect(substituteVariables('{{state.variables.score}}', state)).toBe('42');
  });

  it('falls back to input sub-key when path starts with input.', () => {
    const state = makeState({ input: { topic: 'AI' } });
    expect(substituteVariables('{{input.topic}}', state)).toBe('AI');
  });

  it('keeps template if value is null', () => {
    const state = makeState({ n: null });
    expect(substituteVariables('{{n}}', state)).toBe('{{n}}');
  });
});

describe('substituteInValue', () => {
  it('substitutes inside a nested object', () => {
    const state = makeState({ greeting: 'hi' });
    const result = substituteInValue({ msg: '{{greeting}}' }, state);
    expect(result).toEqual({ msg: 'hi' });
  });

  it('substitutes inside arrays', () => {
    const state = makeState({ x: '1' });
    const result = substituteInValue(['{{x}}', 'static'], state);
    expect(result).toEqual(['1', 'static']);
  });

  it('passes through numbers unchanged', () => {
    const state = makeState({});
    expect(substituteInValue(99, state)).toBe(99);
  });

  it('passes through booleans unchanged', () => {
    const state = makeState({});
    expect(substituteInValue(false, state)).toBe(false);
  });

  it('handles null gracefully', () => {
    expect(substituteInValue(null, makeState({}))).toBeNull();
  });

  it('substitutes deeply nested paths', () => {
    const state = makeState({ meta: { author: { name: 'Bob' } } });
    const result = substituteInValue({ label: '{{meta.author.name}}' }, state);
    expect(result).toEqual({ label: 'Bob' });
  });
});
