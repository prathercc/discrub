import { describe, it, expect } from 'vitest';
import { buildEmojiDataset, resolveEmojiInput } from './emojiDataset';

// Tiny fixtures mirroring the emojibase compact shape.
const compact = [
  { hexcode: '1F600', unicode: '😀', label: 'grinning face', group: 0, order: 1 },
  { hexcode: '1F602', unicode: '😂', label: 'face with tears of joy', group: 0, order: 5 },
  { hexcode: '1F436', unicode: '🐶', label: 'dog face', group: 3, order: 2 },
  { hexcode: '1F525', unicode: '🔥', label: 'fire', group: 5, order: 3 },
  // group 2 (skin-tone component) — must be excluded
  { hexcode: '1F3FB', unicode: '🏻', label: 'light skin tone', group: 2, order: 9 },
  // groupless (regional indicator) — must be excluded
  { hexcode: '1F1E6', unicode: '🇦', label: 'regional indicator A', order: 0 },
];

const shortcodes = {
  '1F600': 'grinning',
  '1F602': ['joy', 'lol'],
  '1F436': 'dog',
  '1F525': 'fire',
};

describe('buildEmojiDataset', () => {
  it('categorizes by group name and excludes components + groupless rows', () => {
    const ds = buildEmojiDataset(compact, shortcodes);
    const names = ds.categories.map((c) => c.name);
    expect(names).toEqual(['Smileys & Emotion', 'Animals & Nature', 'Travel & Places']);
    // 4 renderable, 2 excluded
    expect(ds.all).toHaveLength(4);
    expect(ds.all.some((e) => e.label === 'light skin tone')).toBe(false);
    expect(ds.all.some((e) => e.hexcode === '1F1E6')).toBe(false);
  });

  it('sorts emojis within a category by order', () => {
    const ds = buildEmojiDataset(compact, shortcodes);
    const smileys = ds.categories.find((c) => c.group === 0)!;
    expect(smileys.emojis.map((e) => e.unicode)).toEqual(['😀', '😂']);
  });

  it('normalizes string and array shortcodes (lowercased)', () => {
    const ds = buildEmojiDataset(compact, shortcodes);
    expect(ds.byShortcode.get('grinning')?.unicode).toBe('😀');
    expect(ds.byShortcode.get('joy')?.unicode).toBe('😂');
    expect(ds.byShortcode.get('lol')?.unicode).toBe('😂');
  });
});

describe('resolveEmojiInput', () => {
  const ds = buildEmojiDataset(compact, shortcodes);

  it('resolves :shortcode: and bare shortcode to the unicode char', () => {
    expect(resolveEmojiInput(':fire:', ds)).toEqual({ name: '🔥' });
    expect(resolveEmojiInput('fire', ds)).toEqual({ name: '🔥' });
    expect(resolveEmojiInput('  JOY  ', ds)).toEqual({ name: '😂' });
  });

  it('returns null for an unknown shortcode rather than guessing', () => {
    expect(resolveEmojiInput(':definitely-not-real:', ds)).toBeNull();
    expect(resolveEmojiInput('', ds)).toBeNull();
  });

  it('passes a raw pasted unicode emoji straight through', () => {
    expect(resolveEmojiInput('🎉', ds)).toEqual({ name: '🎉' });
  });

  it('parses a Discord custom-emoji token', () => {
    expect(resolveEmojiInput('<:pepe:123456789>', ds)).toEqual({
      id: '123456789',
      name: 'pepe',
      animated: false,
    });
    expect(resolveEmojiInput('<a:dance:987654321>', ds)).toEqual({
      id: '987654321',
      name: 'dance',
      animated: true,
    });
  });

  it('parses a bare name:id pair', () => {
    expect(resolveEmojiInput('catjam:42', ds)).toEqual({ id: '42', name: 'catjam' });
  });
});
