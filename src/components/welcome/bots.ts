/**
 * Data behind the WelcomePanel corkboard: the Discord bots Prather Bytecraft
 * ships alongside Discrub. Adding a bot is a data change here, nothing else.
 *
 * Copy mirrors `BOTS` in the pratherbytecraft.com catalog so the site and the
 * board agree. Install links go through the site's counted redirect
 * (`/go/<slug>?from=discrub`) so installs that start in Discrub are countable
 * without Discrub itself doing any analytics.
 */

export interface BotEntry {
  /** Stable id, also the redirect slug on pratherbytecraft.com. */
  id: string;
  name: string;
  /** One line under the name; identical to the site tagline. */
  tagline: string;
  /** The Discrub-specific pitch, one or two short sentences. */
  pitch: string;
  /** What the user gets, in their words. Two or three words each. */
  chips: string[];
  /** Counted redirect to the Discord install flow. */
  installUrl: string;
  /** Product page on pratherbytecraft.com. */
  pageUrl: string;
  /** Optional time-limited sticker rendered on the board's sticky note. */
  sticker?: string;
}

const SITE = 'https://pratherbytecraft.com';

export const BOTS: BotEntry[] = [
  {
    id: 'retrostat',
    name: 'Retrostat',
    tagline: 'Retrospective statistics for any date range',
    pitch:
      'The metrics you gather by hand in Discrub, delivered inside your server with a chart and a CSV. Nothing to set up first.',
    chips: ['Top posters', 'Most mentioned', 'Busiest channels', 'Weekly recaps'],
    installUrl: `${SITE}/go/retrostat?from=discrub`,
    pageUrl: `${SITE}/retrostat`,
    sticker: 'Become a founder. The first 100 servers get Premium for life.',
  },
];

/** Where bot ideas go; mirrors the site's workbench address. */
export const BOT_IDEA_MAILTO = 'mailto:workbench@pratherbytecraft.com?subject=Bot%20idea';

/** Persisted under `Discrub-state`; true when the user folded the board. */
export const CORKBOARD_COLLAPSED_STORAGE_KEY = 'welcome:corkboardCollapsed';
