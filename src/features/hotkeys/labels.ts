import { t } from '@/i18n';
import type { HotkeyMeta, HotkeyScope } from './types';
import { getScopeBlurb, getScopeLabel } from './scopeGroups';

/**
 * Localized copy for the hotkey registry (#124). The registry keeps its
 * English `label` / `description` as the source of truth and fallback;
 * these helpers look the translation up by action id and scope.
 */
export const hotkeyLabel = (meta: HotkeyMeta): string =>
  t(`hotkeys.action.${meta.id}.label`, { defaultValue: meta.label });

export const hotkeyDescription = (meta: HotkeyMeta): string =>
  t(`hotkeys.action.${meta.id}.description`, { defaultValue: meta.description });

export const hotkeyScopeTitle = (scope: HotkeyScope | 'mixed'): string =>
  t(`hotkeys.group.${scope}.title`, { defaultValue: scope === 'mixed' ? scope : getScopeLabel(scope) });

export const hotkeyScopeBlurb = (scope: HotkeyScope | 'mixed'): string =>
  t(`hotkeys.group.${scope}.blurb`, { defaultValue: scope === 'mixed' ? '' : getScopeBlurb(scope) });
