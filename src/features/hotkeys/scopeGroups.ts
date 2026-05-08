import type { HotkeyScope } from './types';
import { HOTKEY_ACTIONS } from './defaults';
import type { HotkeyMeta } from './types';

/**
 * Group label + ordering for the Settings tab and reference modal
 * (#144). Order matches the design priority: operation control →
 * in-channel actions → app-wide affordances. Keep this list aligned
 * with the strategic direction in `backlog_hotkey_audit_and_customize.md`.
 */
export interface ScopeGroup {
  scope: HotkeyScope | 'mixed';
  title: string;
  /** One-line description shown under the group header. */
  blurb: string;
  actions: HotkeyMeta[];
}

const GROUP_DEFS: Array<Omit<ScopeGroup, 'actions'>> = [
  {
    scope: 'operationRunning',
    title: 'During an operation',
    blurb: 'Available while a purge or export is in flight.',
  },
  {
    scope: 'serverViewWithChannel',
    title: 'In a channel',
    blurb: 'Available when viewing a server channel with messages loaded.',
  },
  {
    scope: 'serverView',
    title: 'In a server',
    blurb: 'Available when the server browser is active.',
  },
  {
    scope: 'app',
    title: 'App-wide',
    blurb: 'Available anywhere Discrub is in the foreground.',
  },
];

/**
 * Build the grouped action list, preserving each action's declaration
 * order within its group. Empty groups are dropped entirely so the
 * Settings tab doesn't render an empty section header if a future
 * scope is removed from the registry.
 */
export function buildScopeGroups(actions: HotkeyMeta[] = HOTKEY_ACTIONS): ScopeGroup[] {
  return GROUP_DEFS.map((g) => ({
    ...g,
    actions: actions.filter((a) => a.scope === g.scope),
  })).filter((g) => g.actions.length > 0);
}

/** Look up the human label for a scope value. */
export function getScopeLabel(scope: HotkeyScope): string {
  return GROUP_DEFS.find((g) => g.scope === scope)?.title ?? scope;
}

/** Look up the contextual blurb for a scope (matches the Settings tab subtitle). */
export function getScopeBlurb(scope: HotkeyScope): string {
  return GROUP_DEFS.find((g) => g.scope === scope)?.blurb ?? '';
}
