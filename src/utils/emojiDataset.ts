/**
 * Unicode emoji dataset for the bulk-add-reactions picker.
 *
 * Source: emojibase-data. We use the `iamcal` shortcode preset because Discord's
 * `:shortcodes:` are historically the iamcal (emoji-data) set — e.g. :joy:, :+1:,
 * :white_check_mark: — so it's the closest client-side match to what Discord accepts.
 * There is no authoritative "Discord emoji list" endpoint; the genuine validator is
 * Discord's reaction call itself (a rejected emoji surfaces as a 10014 status line).
 *
 * The dataset JSON is loaded lazily (dynamic import) so it is code-split out of the
 * main bundle and only fetched when the emoji picker first opens.
 */

/** An emoji selectable for a reaction. Unicode emojis carry only `name` (the char);
 * custom guild emojis carry `id` + `name` (+ `animated`). Mirrors getEmojiKey()'s shape. */
export interface SelectableEmoji {
  id?: string;
  name: string;
  animated?: boolean;
}

export interface UnicodeEmoji {
  hexcode: string;
  /** The character to render and send to Discord. */
  unicode: string;
  /** Human-readable label, e.g. "grinning face". */
  label: string;
  /** iamcal/Discord shortcodes (no surrounding colons), lowercased. */
  shortcodes: string[];
}

export interface EmojiCategory {
  group: number;
  name: string;
  emojis: UnicodeEmoji[];
}

export interface EmojiDataset {
  categories: EmojiCategory[];
  all: UnicodeEmoji[];
  byShortcode: Map<string, UnicodeEmoji>;
}

/** emojibase compact-emoji row (subset we use). */
interface CompactEmoji {
  hexcode: string;
  unicode: string;
  label: string;
  group?: number;
  order?: number;
}

type ShortcodePreset = Record<string, string | string[]>;

/** emojibase numeric group → display name. Group 2 ("Component" — skin tones) and
 * groupless rows (regional indicators) are intentionally omitted. */
const GROUP_NAMES: Record<number, string> = {
  0: 'Smileys & Emotion',
  1: 'People & Body',
  3: 'Animals & Nature',
  4: 'Food & Drink',
  5: 'Travel & Places',
  6: 'Activities',
  7: 'Objects',
  8: 'Symbols',
  9: 'Flags',
};

/** Build the categorized dataset + shortcode index from raw emojibase data. Pure. */
export function buildEmojiDataset(
  compact: CompactEmoji[],
  shortcodes: ShortcodePreset
): EmojiDataset {
  const byShortcode = new Map<string, UnicodeEmoji>();
  const categoryMap = new Map<number, UnicodeEmoji[]>();
  const all: UnicodeEmoji[] = [];

  const renderable = compact
    .filter((e) => e.group !== undefined && GROUP_NAMES[e.group] !== undefined)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const e of renderable) {
    const raw = shortcodes[e.hexcode];
    const codes = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) =>
      c.toLowerCase()
    );
    const emoji: UnicodeEmoji = {
      hexcode: e.hexcode,
      unicode: e.unicode,
      label: e.label,
      shortcodes: codes,
    };
    all.push(emoji);

    const group = e.group as number;
    const bucket = categoryMap.get(group);
    if (bucket) bucket.push(emoji);
    else categoryMap.set(group, [emoji]);

    // First shortcode wins on collision (stable, dataset is order-sorted).
    for (const c of codes) if (!byShortcode.has(c)) byShortcode.set(c, emoji);
  }

  const categories: EmojiCategory[] = [...categoryMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([group, emojis]) => ({ group, name: GROUP_NAMES[group], emojis }));

  return { categories, all, byShortcode };
}

/**
 * Resolve free-text input from the picker's "Other" box into a selectable emoji.
 * Accepts: a `:shortcode:` or bare `shortcode`, a raw unicode emoji character, a
 * Discord custom-emoji token `<:name:id>` / `<a:name:id>`, or a `name:id` pair.
 * Returns null when nothing resolves. Unknown shortcodes are NOT guessed — they
 * return null so the user gets feedback rather than a silent Discord rejection.
 */
export function resolveEmojiInput(
  input: string,
  dataset: Pick<EmojiDataset, 'byShortcode'>
): SelectableEmoji | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Discord custom-emoji token: <:name:id> or animated <a:name:id>
  const customToken = trimmed.match(/^<(a)?:(\w+):(\d+)>$/);
  if (customToken) {
    return { id: customToken[3], name: customToken[2], animated: Boolean(customToken[1]) };
  }

  // Bare name:id pair
  const nameId = trimmed.match(/^(\w+):(\d+)$/);
  if (nameId) return { id: nameId[2], name: nameId[1] };

  // :shortcode: or shortcode
  const shortcode = trimmed.replace(/^:+/, '').replace(/:+$/, '').toLowerCase();
  const found = dataset.byShortcode.get(shortcode);
  if (found) return { name: found.unicode };

  // Raw pasted unicode emoji — let Discord be the final validator.
  if (/\p{Extended_Pictographic}/u.test(trimmed)) return { name: trimmed };

  return null;
}

let cached: Promise<EmojiDataset> | null = null;

/** Lazily load + build the dataset (memoized). Dynamic import keeps the ~200KB of
 * emoji JSON out of the initial bundle until the picker is opened. */
export function loadEmojiDataset(): Promise<EmojiDataset> {
  if (!cached) {
    cached = Promise.all([
      import('emojibase-data/en/compact.json'),
      import('emojibase-data/en/shortcodes/iamcal.json'),
    ]).then(([compact, shortcodes]) =>
      buildEmojiDataset(
        ((compact as { default?: CompactEmoji[] }).default ??
          (compact as unknown as CompactEmoji[])),
        ((shortcodes as { default?: ShortcodePreset }).default ??
          (shortcodes as unknown as ShortcodePreset))
      )
    );
  }
  return cached;
}

/** Test-only: reset the memoized dataset. */
export function __resetEmojiDatasetCache(): void {
  cached = null;
}
