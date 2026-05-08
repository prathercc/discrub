import type { HotkeyActionId, HotkeyBinding } from './types';

/**
 * Identify which bindings are duplicated across actions.
 *
 * Returns a map keyed by the conflicting binding string, with the
 * action IDs sharing that binding as the value. Only entries with at
 * least two action IDs are included — non-conflicting bindings are
 * omitted entirely so callers can iterate without a "length > 1" check.
 *
 * Used by the Settings tab to inline-warn each conflicting row, and by
 * save validation in capture-mode rebind to prompt before clobbering.
 */
export function findHotkeyConflicts(
  bindings: Record<HotkeyActionId, HotkeyBinding>,
): Map<HotkeyBinding, HotkeyActionId[]> {
  const byKey = new Map<HotkeyBinding, HotkeyActionId[]>();
  for (const [id, key] of Object.entries(bindings) as [HotkeyActionId, HotkeyBinding][]) {
    // An empty / unset binding isn't a conflict — skip rather than
    // group every "blank" together as if they all collide.
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(id);
    byKey.set(key, list);
  }
  for (const [k, v] of byKey) {
    if (v.length < 2) byKey.delete(k);
  }
  return byKey;
}

/**
 * Returns the action IDs (other than `selfId`) that share the given
 * binding, if any. Useful in the capture-mode UI: when the user picks a
 * key, we want to surface "this would also override <other action>"
 * without flagging the user's own row as a conflict with itself.
 */
export function findConflictingActions(
  bindings: Record<HotkeyActionId, HotkeyBinding>,
  selfId: HotkeyActionId,
  candidateBinding: HotkeyBinding,
): HotkeyActionId[] {
  if (!candidateBinding) return [];
  const conflicts: HotkeyActionId[] = [];
  for (const [id, key] of Object.entries(bindings) as [HotkeyActionId, HotkeyBinding][]) {
    if (id === selfId) continue;
    if (key === candidateBinding) conflicts.push(id);
  }
  return conflicts;
}
