import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBleedingEdgeBuild } from './hostedGate';

vi.mock('@/extension/messaging', () => ({ isExtensionMode: () => false }));

type Seams = { __hostedGateOverride__?: boolean; __bleedingEdgeOverride__?: boolean };
const w = window as unknown as Seams;

describe('isBleedingEdgeBuild', () => {
  afterEach(() => {
    delete w.__hostedGateOverride__;
    delete w.__bleedingEdgeOverride__;
  });

  it('is true whenever the hosted gate is on, even with the branding override off', () => {
    w.__hostedGateOverride__ = true;
    w.__bleedingEdgeOverride__ = false;
    expect(isBleedingEdgeBuild()).toBe(true);
  });

  it('is false when the dev-only branding override is set to false', () => {
    w.__bleedingEdgeOverride__ = false;
    expect(isBleedingEdgeBuild()).toBe(false);
  });
});
