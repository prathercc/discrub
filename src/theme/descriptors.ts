/**
 * Theme descriptors — the palette-level source of truth the theme
 * factory (`createAppTheme.ts`) builds full MUI themes from.
 *
 * A descriptor is intentionally small: only the colors that genuinely
 * differ between themes live here. Everything else (typography, shape,
 * transitions, component overrides, glass/glow derivations) is shared
 * and derived by the factory, so adding a theme means adding ONE
 * descriptor entry — never another hand-built `createTheme` call.
 *
 * v2.1.0 roster: the free and supporter palettes land in a later slot;
 * this file starts with the two existing Discord themes migrated
 * verbatim (every hex below matches the pre-factory `theme.ts`).
 */

export type ThemeBase = 'dark' | 'light';
export type ThemeTier = 'free' | 'supporter';

export interface ThemeDescriptorPalette {
  primary: { main: string; light: string; dark: string; contrastText: string };
  secondary: { main: string; light: string; dark: string };
  background: { default: string; paper: string; elevated: string };
  text: { primary: string; secondary: string };
  error: string;
  warning: string;
  success: string;
  divider: string;
  /** Solid base color the translucent glass surfaces are mixed from. */
  glassBase: string;
  /** Dialog paper backdrop (translucent values allowed). */
  dialog: string;
  /** Tooltip/arrow backdrop (translucent values allowed). */
  tooltip: string;
  link: { main: string; hover: string };
  /** Contained-button (call-to-action) color ramp. */
  cta: { main: string; hover: string; active: string };
  /** Destructive contained-button color ramp. */
  ctaDanger: { main: string; hover: string; active: string };
  gradient: { primary: string; primarySubtle: string; overlay: string };
}

export interface ThemeDescriptor {
  /** Stable id persisted in APP_THEME_MODE. Never 'auto'. */
  id: string;
  /** Display name for pickers and tooltips. */
  name: string;
  /** MUI palette mode the theme renders in. */
  base: ThemeBase;
  tier: ThemeTier;
  palette: ThemeDescriptorPalette;
}

export const DISCORD_DARK_ID = 'discord-dark';
export const DISCORD_LIGHT_ID = 'discord-light';

const discordDark: ThemeDescriptor = {
  id: DISCORD_DARK_ID,
  name: 'Dark Original',
  base: 'dark',
  tier: 'free',
  palette: {
    primary: { main: '#7289da', light: '#99aab5', dark: '#5865f2', contrastText: '#fff' },
    secondary: { main: '#d2d5f7', light: '#ffffff', dark: '#99aab5' },
    background: { default: '#1e2124', paper: '#282b30', elevated: '#2e3338' },
    text: { primary: '#ffffff', secondary: '#d2d5f7' },
    error: '#f04747',
    warning: '#faa61a',
    success: '#43b581',
    divider: 'rgba(255, 255, 255, 0.12)',
    glassBase: '#282b30',
    dialog: 'rgba(54, 57, 63, 0.95)',
    tooltip: 'rgba(40, 43, 48, 0.98)',
    link: { main: '#00b0f4', hover: '#00d4ff' },
    cta: { main: '#5865f2', hover: '#4752c4', active: '#3c45a5' },
    ctaDanger: { main: '#ed4245', hover: '#d83c3e', active: '#c43538' },
    gradient: {
      primary: 'linear-gradient(135deg, #7289da 0%, #5865f2 100%)',
      primarySubtle: 'linear-gradient(135deg, rgba(114, 137, 218, 0.1) 0%, rgba(88, 101, 242, 0.15) 100%)',
      overlay: 'linear-gradient(180deg, rgba(114, 137, 218, 0.05) 0%, transparent 100%)',
    },
  },
};

const discordLight: ThemeDescriptor = {
  id: DISCORD_LIGHT_ID,
  name: 'Light Original',
  base: 'light',
  tier: 'free',
  palette: {
    primary: { main: '#5865f2', light: '#7289da', dark: '#4752c4', contrastText: '#fff' },
    secondary: { main: '#4f5660', light: '#747f8d', dark: '#2e3338' },
    background: { default: '#ffffff', paper: '#f2f3f5', elevated: '#e3e5e8' },
    text: { primary: '#2e3338', secondary: '#4f5660' },
    error: '#d83c3e',
    warning: '#e67e22',
    success: '#2d8b5e',
    divider: 'rgba(0, 0, 0, 0.08)',
    glassBase: '#ffffff',
    dialog: 'rgba(255, 255, 255, 0.98)',
    tooltip: 'rgba(255, 255, 255, 0.98)',
    link: { main: '#0067e0', hover: '#004db3' },
    cta: { main: '#5865f2', hover: '#4752c4', active: '#3c45a5' },
    ctaDanger: { main: '#d83c3e', hover: '#c43538', active: '#b02e31' },
    gradient: {
      primary: 'linear-gradient(135deg, #5865f2 0%, #7289da 100%)',
      primarySubtle: 'linear-gradient(135deg, rgba(88, 101, 242, 0.06) 0%, rgba(114, 137, 218, 0.1) 100%)',
      overlay: 'linear-gradient(180deg, rgba(88, 101, 242, 0.03) 0%, transparent 100%)',
    },
  },
};

/** Registry, in display order. The first entry is the app default. */
export const THEME_DESCRIPTORS: ThemeDescriptor[] = [discordDark, discordLight];

export const DEFAULT_THEME_ID = DISCORD_DARK_ID;
export const DEFAULT_LIGHT_THEME_ID = DISCORD_LIGHT_ID;

/**
 * Pre-registry APP_THEME_MODE values ('dark' / 'light') map onto the
 * Discord themes. Accepted forever — stored settings are never migrated.
 */
const LEGACY_THEME_ALIASES: Record<string, string> = {
  dark: DISCORD_DARK_ID,
  light: DISCORD_LIGHT_ID,
};

/**
 * Look up a descriptor by id, accepting legacy aliases. Returns
 * undefined for 'auto', unknown ids, or missing values — callers
 * decide the fallback (ThemeWrapper auto-detects, getThemeById
 * falls back to the default theme).
 */
export function findThemeDescriptor(id: string | undefined): ThemeDescriptor | undefined {
  if (!id) return undefined;
  const canonical = LEGACY_THEME_ALIASES[id] ?? id;
  return THEME_DESCRIPTORS.find((d) => d.id === canonical);
}
