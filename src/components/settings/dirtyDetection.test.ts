import { describe, it, expect } from 'vitest';
import {
  settingsEqual,
  hotkeysEqual,
  hasUnsavedSettingsChanges,
} from './dirtyDetection';
import { defaultSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { DEFAULT_HOTKEYS } from '@features/hotkeys/defaults';
import type { HotkeysState } from '@features/hotkeys/types';

const baseHotkeys: HotkeysState = {
  enabled: true,
  bindings: { ...DEFAULT_HOTKEYS },
};

describe('settingsEqual', () => {
  it('returns true for identical settings objects', () => {
    expect(settingsEqual({ ...defaultSettings }, { ...defaultSettings })).toBe(true);
  });

  it('returns false when any value differs', () => {
    expect(
      settingsEqual({ ...defaultSettings }, { ...defaultSettings, [DiscrubSetting.SEARCH_DELAY]: '7' }),
    ).toBe(false);
  });

  it('returns false when one side has an extra key', () => {
    const extra = { ...defaultSettings, _extra: 'x' } as any;
    expect(settingsEqual(defaultSettings, extra)).toBe(false);
  });
});

describe('hotkeysEqual', () => {
  it('returns true for identical hotkey states', () => {
    expect(hotkeysEqual(baseHotkeys, { ...baseHotkeys, bindings: { ...baseHotkeys.bindings } }))
      .toBe(true);
  });

  it('returns false when enabled differs', () => {
    expect(hotkeysEqual(baseHotkeys, { ...baseHotkeys, enabled: false })).toBe(false);
  });

  it('returns false when any binding differs', () => {
    expect(
      hotkeysEqual(baseHotkeys, {
        ...baseHotkeys,
        bindings: { ...baseHotkeys.bindings, toggleFocus: 'Q' },
      }),
    ).toBe(false);
  });

  it('returns false when one side has an extra binding', () => {
    expect(
      hotkeysEqual(baseHotkeys, {
        ...baseHotkeys,
        bindings: { ...baseHotkeys.bindings, _extra: 'x' } as any,
      }),
    ).toBe(false);
  });
});

describe('hasUnsavedSettingsChanges', () => {
  it('returns false when both forms match Redux state', () => {
    expect(
      hasUnsavedSettingsChanges({
        formValues: defaultSettings,
        settings: defaultSettings,
        formHotkeys: baseHotkeys,
        hotkeys: baseHotkeys,
      }),
    ).toBe(false);
  });

  it('returns true when only AppSettings differs', () => {
    expect(
      hasUnsavedSettingsChanges({
        formValues: { ...defaultSettings, [DiscrubSetting.SEARCH_DELAY]: '7' },
        settings: defaultSettings,
        formHotkeys: baseHotkeys,
        hotkeys: baseHotkeys,
      }),
    ).toBe(true);
  });

  it('returns true when only hotkeys differ', () => {
    expect(
      hasUnsavedSettingsChanges({
        formValues: defaultSettings,
        settings: defaultSettings,
        formHotkeys: { ...baseHotkeys, enabled: false },
        hotkeys: baseHotkeys,
      }),
    ).toBe(true);
  });

  it('returns true when both differ', () => {
    expect(
      hasUnsavedSettingsChanges({
        formValues: { ...defaultSettings, [DiscrubSetting.SEARCH_DELAY]: '7' },
        settings: defaultSettings,
        formHotkeys: { ...baseHotkeys, enabled: false },
        hotkeys: baseHotkeys,
      }),
    ).toBe(true);
  });
});
