/**
 * Random content + variety helpers for the seeder (#153).
 *
 * Goal: produce text varied enough that purge/export/search testing
 * surfaces edge cases (long content, multi-line, mentions, special
 * chars) without resorting to external content libraries.
 */

const SHORT_TEMPLATES = [
  'Test message',
  'Quick check',
  'Hello world',
  'lorem ipsum',
  'lol',
  'wat',
  'noted',
  'gg',
  'sounds good',
  'on it',
  'ack',
  'agreed',
  'yep',
  'no idea',
  'standby',
  'thinking emoji',
  'shipped it',
  'rebasing',
  'wait what',
  'thanks!',
];

const MEDIUM_TEMPLATES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.',
  "Ran into something weird with the export — pinging here so we don't lose it.",
  'Confirmed working on my end. Going to land it after lunch and watch the dashboards.',
  "There's a deeper issue here that I want to chase before we ship the patch.",
  'Just a sanity-check: does this also affect the bulk path or only single-channel?',
  'Adding a small note: the rate-limit tweak should make this safe even at 5x volume.',
  'Final answer (after the third coffee): we treat 404 as a soft signal, not an error.',
];

const LONG_TEMPLATES = [
  "Going to dump everything I know about this so we have a paper trail. The original report came from a user with a multi-gigabyte data package, and the parser was throwing 'expected N records, got 0' which turned out to be a JSZip ZIP64 limitation. Swapping to fflate fixed it because fflate handles ZIP64 natively. The downstream effect was that every 4GB+ archive was failing import; the fix unblocks heavy-account users.",
  "Thread for tracking the regression. Repro: open the package, click any non-text channel, then come back. Console shows a warning about a stale enrichment cache key. Suspect the channel-ID guard in the dispatch was missing, but I want to confirm before changing anything. Will pair with whoever picks this up tomorrow.",
];

const REACTION_EMOJI = ['👍', '🎉', '🚀', '🔥', '✅', '🤔', '😂', '👀', '💯', '🙏'];

export interface SeedContentOptions {
  /** Insert a self-mention into ~15% of messages. */
  includeMentions: boolean;
  selfUserId: string | null;
}

/**
 * Generate one message body. Length distribution: 70% short,
 * 22% medium, 8% long. Multi-line is sprinkled into long bodies
 * via embedded newlines from the templates above.
 */
export function generateMessageContent(opts: SeedContentOptions, rng: () => number): string {
  const r = rng();
  let base: string;
  if (r < 0.7) {
    base = SHORT_TEMPLATES[Math.floor(rng() * SHORT_TEMPLATES.length)];
  } else if (r < 0.92) {
    base = MEDIUM_TEMPLATES[Math.floor(rng() * MEDIUM_TEMPLATES.length)];
  } else {
    base = LONG_TEMPLATES[Math.floor(rng() * LONG_TEMPLATES.length)];
  }

  // Include a mention in ~15% of messages when enabled. Self-mention
  // is the only safe target — mentioning others would notify them.
  if (opts.includeMentions && opts.selfUserId && rng() < 0.15) {
    base = `<@${opts.selfUserId}> ${base}`;
  }

  return base;
}

/** Pick a random reaction emoji from the small fixed set. */
export function randomReactionEmoji(rng: () => number): string {
  return REACTION_EMOJI[Math.floor(rng() * REACTION_EMOJI.length)];
}

/**
 * Cheap deterministic RNG (mulberry32) so seed runs in tests are
 * reproducible without pulling a dep. Production code uses Math.random.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
