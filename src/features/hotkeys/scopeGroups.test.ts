import { describe, it, expect } from 'vitest';
import { buildScopeGroups, getScopeBlurb, getScopeLabel } from './scopeGroups';
import { HOTKEY_ACTIONS } from './defaults';

describe('buildScopeGroups', () => {
  it('returns groups in the priority order: operationRunning → in-channel → in-server → app', () => {
    const groups = buildScopeGroups();
    const order = groups.map((g) => g.scope);
    // operationRunning ahead of in-channel, in-channel ahead of app.
    expect(order.indexOf('operationRunning')).toBeLessThan(order.indexOf('serverViewWithChannel'));
    expect(order.indexOf('serverViewWithChannel')).toBeLessThan(order.indexOf('app'));
  });

  it('every action in HOTKEY_ACTIONS lands in exactly one group', () => {
    const groups = buildScopeGroups();
    const seen = new Set<string>();
    for (const g of groups) {
      for (const a of g.actions) {
        expect(seen.has(a.id)).toBe(false);
        seen.add(a.id);
      }
    }
    expect(seen.size).toBe(HOTKEY_ACTIONS.length);
  });

  it('omits groups whose scope has no actions', () => {
    const noPackage = HOTKEY_ACTIONS.filter((a) => a.scope !== 'packageView');
    const groups = buildScopeGroups(noPackage);
    expect(groups.find((g) => g.scope === 'packageView')).toBeUndefined();
  });
});

describe('getScopeLabel / getScopeBlurb', () => {
  it('returns a non-empty label for every known scope', () => {
    for (const scope of ['app', 'serverView', 'serverViewWithChannel', 'operationRunning'] as const) {
      expect(getScopeLabel(scope).length).toBeGreaterThan(0);
      expect(getScopeBlurb(scope).length).toBeGreaterThan(0);
    }
  });
});
