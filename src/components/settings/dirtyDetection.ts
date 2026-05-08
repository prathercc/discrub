import type { AppSettings } from 'discrub-core/types/discrub-types';
import type { HotkeysState } from '@features/hotkeys/types';
import type { HotkeyActionId } from '@features/hotkeys/types';

/**
 * Shallow equality for two AppSettings objects (#164).
 *
 * Both objects are flat string maps in practice; the union of keys
 * covers any field that differs, including ones present in only one
 * side (which would otherwise fall through a one-sided iteration).
 *
 * Using strict `!==` is safe — every AppSettings value is a string
 * primitive, so reference identity matches structural equality.
 */
export function settingsEqual(a: AppSettings, b: AppSettings): boolean {
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
  ]) as Set<keyof AppSettings>;
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** Shallow equality for two HotkeysState objects (#164). */
export function hotkeysEqual(a: HotkeysState, b: HotkeysState): boolean {
  if (a.enabled !== b.enabled) return false;
  const keys = new Set([
    ...Object.keys(a.bindings),
    ...Object.keys(b.bindings),
  ]) as Set<HotkeyActionId>;
  for (const k of keys) {
    if (a.bindings[k] !== b.bindings[k]) return false;
  }
  return true;
}

/**
 * True iff the dialog's working copies differ from the persisted
 * Redux state. Closing the dialog while this is true silently throws
 * away the user's edits, which is what the prompt prevents.
 */
export function hasUnsavedSettingsChanges(opts: {
  formValues: AppSettings;
  settings: AppSettings;
  formHotkeys: HotkeysState;
  hotkeys: HotkeysState;
}): boolean {
  return (
    !settingsEqual(opts.formValues, opts.settings) ||
    !hotkeysEqual(opts.formHotkeys, opts.hotkeys)
  );
}
