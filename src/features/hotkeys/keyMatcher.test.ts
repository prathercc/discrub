import { describe, it, expect } from 'vitest';
import { eventToBinding, formatBindingForDisplay } from './keyMatcher';

function evt(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('eventToBinding', () => {
  it('returns the uppercase letter for a plain letter keydown', () => {
    expect(eventToBinding(evt({ key: 'f' }))).toBe('F');
    expect(eventToBinding(evt({ key: 'L' }))).toBe('L');
  });

  it('preserves typed punctuation', () => {
    expect(eventToBinding(evt({ key: '/' }))).toBe('/');
    expect(eventToBinding(evt({ key: '?' }))).toBe('?');
    expect(eventToBinding(evt({ key: ',' }))).toBe(',');
  });

  it('translates the literal space character to "Space"', () => {
    expect(eventToBinding(evt({ key: ' ' }))).toBe('Space');
  });

  it('preserves named keys verbatim', () => {
    expect(eventToBinding(evt({ key: 'Escape' }))).toBe('Escape');
    expect(eventToBinding(evt({ key: 'ArrowLeft' }))).toBe('ArrowLeft');
  });

  it('prepends "mod+" when Cmd or Ctrl is held', () => {
    expect(eventToBinding(evt({ key: ',', metaKey: true }))).toBe('mod+,');
    expect(eventToBinding(evt({ key: '.', ctrlKey: true }))).toBe('mod+.');
    expect(eventToBinding(evt({ key: 'k', ctrlKey: true }))).toBe('mod+K');
  });

  it('does NOT fold Alt into "mod" (Alt+key is reserved)', () => {
    expect(eventToBinding(evt({ key: 'f', altKey: true }))).toBe('F');
  });

  it('returns null for bare modifier keypresses', () => {
    expect(eventToBinding(evt({ key: 'Control' }))).toBeNull();
    expect(eventToBinding(evt({ key: 'Meta' }))).toBeNull();
    expect(eventToBinding(evt({ key: 'Shift' }))).toBeNull();
    expect(eventToBinding(evt({ key: 'Alt' }))).toBeNull();
  });
});

describe('formatBindingForDisplay', () => {
  it('passes bare keys through unchanged', () => {
    expect(formatBindingForDisplay('F')).toBe('F');
    expect(formatBindingForDisplay('/')).toBe('/');
    expect(formatBindingForDisplay('Space')).toBe('Space');
  });

  it('uses ⌘ on Mac for "mod+" bindings', () => {
    expect(formatBindingForDisplay('mod+,', true)).toBe('⌘,');
    expect(formatBindingForDisplay('mod+.', true)).toBe('⌘.');
  });

  it('uses Ctrl+ on non-Mac', () => {
    expect(formatBindingForDisplay('mod+,', false)).toBe('Ctrl+,');
  });

  it('returns empty string for empty input', () => {
    expect(formatBindingForDisplay('')).toBe('');
  });
});
