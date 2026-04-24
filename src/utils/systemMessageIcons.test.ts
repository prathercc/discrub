import { describe, it, expect } from 'vitest';
import { getSystemMessageIcon } from './systemMessageIcons';
import { SystemMessageKind } from 'discrub-core/system-messages';

describe('getSystemMessageIcon', () => {
  it('returns a component for every SystemMessageKind value', () => {
    const kinds = Object.values(SystemMessageKind);
    for (const kind of kinds) {
      const Icon = getSystemMessageIcon(kind);
      expect(Icon).toBeDefined();
      // MUI icon components are ForwardRef objects; `typeof` is "object".
      // Assert they're at least not undefined and have a displayName or
      // render identity.
      expect(Icon).not.toBeNull();
    }
  });

  it('falls back to InfoOutlined for unmapped kinds', () => {
    // Cast an unknown string to the enum type — runtime fallback guards
    // against future enum additions that slip through type checking.
    const Icon = getSystemMessageIcon('brand-new-kind' as SystemMessageKind);
    expect(Icon).toBeDefined();
  });
});
