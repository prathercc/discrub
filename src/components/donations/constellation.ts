import type { Donation } from 'discrub-core/types/discrub-types';

/**
 * Supporter Constellation math — a spec copy of the pratherbytecraft.com
 * Supporter Wall's placement layer (site `src/lib/supporters.ts` +
 * `SupporterWall.tsx`, built 2026-08-03).
 *
 * PARITY CONTRACT: both surfaces read the same public gist, and a
 * supporter's star must sit in the SAME spot in the sky here and on the
 * site ("your star keeps its place in the sky"). That holds only if all
 * of this stays byte-for-byte identical on both sides:
 *   - FNV-1a `hashString` and `mulberry32`
 *   - aggregation (sum per donorId) and the sort (total, descending)
 *   - GRID_COLS (22), the shuffle seed (42), cell assignment `i % cellCount`
 *   - the jitter formulas and the 2/98 + 4/96 percent clamps
 * Change any of it and change the site's copy in the same breath.
 */

export interface Supporter {
  donorId: string;
  name: string;
  total: number;
  count: number;
  subscriptionMonths: number;
  isActiveSubscriber: boolean;
  latestTimestamp: string;
  /** Timestamp of this donor's first contribution — when their star was born. */
  firstTimestamp: string;
  /** Most recent non-empty Ko-Fi message this donor left, if any. */
  message: string;
}

export type ConstellationTierKey = 'gigabyte' | 'megabyte' | 'kilobyte' | 'byte' | 'bit';

export interface ConstellationTier {
  key: ConstellationTierKey;
  name: string;
  color: string;
  min: number;
}

// The PratherByteCraft byte ladder; thresholds and colors match the in-app
// donor feed's tiers.
export const CONSTELLATION_TIERS: ConstellationTier[] = [
  { key: 'gigabyte', name: 'Gigabyte', color: '#b9f2ff', min: 100 },
  { key: 'megabyte', name: 'Megabyte', color: '#e5e4e2', min: 50 },
  { key: 'kilobyte', name: 'Kilobyte', color: '#ffd700', min: 20 },
  { key: 'byte', name: 'Byte', color: '#c0c0c0', min: 5 },
  { key: 'bit', name: 'Bit', color: '#cd7f32', min: 0 },
];

export function getConstellationTier(total: number): ConstellationTier {
  return CONSTELLATION_TIERS.find((t) => total >= t.min) ?? CONSTELLATION_TIERS[CONSTELLATION_TIERS.length - 1];
}

export const TIER_STAR_SIZE: Record<ConstellationTierKey, number> = {
  gigabyte: 18,
  megabyte: 13,
  kilobyte: 10,
  byte: 6,
  bit: 4,
};

const SUBSCRIPTION_TYPE = 'Monthly Tip';
const ACTIVE_GRACE_DAYS = 45;

/**
 * Group donations by donor: sum totals, count contributions, track
 * subscription months, keep the most recent display name. Sorted by
 * total descending — the sort feeds cell assignment, so it is part of
 * the parity contract.
 */
export function aggregateSupporters(donations: Donation[], now: Date = new Date()): Supporter[] {
  const map = new Map<string, Supporter>();
  const messageTs = new Map<string, number>();
  const activeCutoff = now.getTime() - ACTIVE_GRACE_DAYS * 24 * 60 * 60 * 1000;

  for (const d of donations) {
    const isSub = d.type === SUBSCRIPTION_TYPE;
    const ts = new Date(d.timestamp).getTime();
    const msg = d.message?.trim() ?? '';
    const existing = map.get(d.donorId);

    if (existing) {
      existing.total += d.amount;
      existing.count += 1;
      if (isSub) {
        existing.subscriptionMonths += 1;
        if (ts >= activeCutoff) existing.isActiveSubscriber = true;
      }
      if (ts > new Date(existing.latestTimestamp).getTime()) {
        existing.name = d.fromName;
        existing.latestTimestamp = d.timestamp;
      }
      if (ts < new Date(existing.firstTimestamp).getTime()) {
        existing.firstTimestamp = d.timestamp;
      }
      if (msg && ts >= (messageTs.get(d.donorId) ?? -Infinity)) {
        existing.message = msg;
        messageTs.set(d.donorId, ts);
      }
    } else {
      map.set(d.donorId, {
        donorId: d.donorId,
        name: d.fromName,
        total: d.amount,
        count: 1,
        subscriptionMonths: isSub ? 1 : 0,
        isActiveSubscriber: isSub && ts >= activeCutoff,
        latestTimestamp: d.timestamp,
        firstTimestamp: d.timestamp,
        message: msg,
      });
      if (msg) messageTs.set(d.donorId, ts);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID_COLS = 22;

export interface PlacedStar {
  supporter: Supporter;
  tier: ConstellationTier;
  x: number; // percent
  y: number; // percent
  size: number; // px diameter
  twinkleDur: number;
  twinkleDelay: number;
  hasNova: boolean;
}

export function placeStars(supporters: Supporter[], novaIds: Set<string>): PlacedStar[] {
  const rows = Math.max(9, Math.ceil(supporters.length / GRID_COLS));
  const cellCount = GRID_COLS * rows;
  const cells = Array.from({ length: cellCount }, (_, i) => i);
  const shuffle = mulberry32(42);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  // Biggest stars claim cells first so the bright ones spread evenly.
  return supporters.map((supporter, i) => {
    const tier = getConstellationTier(supporter.total);
    const cell = cells[i % cellCount];
    const col = cell % GRID_COLS;
    const row = Math.floor(cell / GRID_COLS);
    const rng = mulberry32(hashString(supporter.donorId));
    const x = ((col + 0.5 + (rng() - 0.5) * 0.85) / GRID_COLS) * 100;
    const y = ((row + 0.5 + (rng() - 0.5) * 0.85) / rows) * 100;
    return {
      supporter,
      tier,
      x: Math.min(98, Math.max(2, x)),
      y: Math.min(96, Math.max(4, y)),
      size: TIER_STAR_SIZE[tier.key],
      twinkleDur: 2.2 + rng() * 3.2,
      twinkleDelay: rng() * 4,
      hasNova: novaIds.has(supporter.donorId),
    };
  });
}

/** How long a star counts as "new" and gets the nova-pulse treatment. */
export const NEW_STAR_DAYS = 14;

/** Only the most recent arrivals pulse; keeps the sky calm. */
export const MAX_NOVA_STARS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isNewSupporter(s: Supporter, now: Date = new Date()): boolean {
  return now.getTime() - new Date(s.firstTimestamp).getTime() < NEW_STAR_DAYS * DAY_MS;
}

export function daysSinceJoined(s: Supporter, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(s.firstTimestamp).getTime()) / DAY_MS));
}

/** The newest arrivals, capped, for the nova pulse. */
export function pickNovaIds(supporters: Supporter[], now: Date = new Date()): Set<string> {
  const ids = new Set(
    supporters
      .filter((s) => isNewSupporter(s, now))
      .sort((a, b) => new Date(b.firstTimestamp).getTime() - new Date(a.firstTimestamp).getTime())
      .slice(0, MAX_NOVA_STARS)
      .map((s) => s.donorId),
  );
  // The reigning top supporter always pulses too (supporters arrive
  // sorted by total, descending) — site parity.
  if (supporters.length > 0) ids.add(supporters[0].donorId);
  return ids;
}

/** The most recently arrived star, for the clickable "newest" stat. */
export function findNewestStar(stars: PlacedStar[]): PlacedStar | null {
  return stars.length === 0
    ? null
    : stars.reduce((a, b) =>
        new Date(a.supporter.firstTimestamp).getTime() >= new Date(b.supporter.firstTimestamp).getTime() ? a : b,
      );
}

/**
 * Ko-Fi placeholder names; these donors shine as unnamed stars rather
 * than repeating "Somebody" across the sky.
 */
const GENERIC_NAMES = new Set(['', 'somebody', 'supporter', 'ko-fi supporter', 'anonymous']);

export function isGenericName(name: string): boolean {
  return GENERIC_NAMES.has(name.trim().toLowerCase());
}

export function displayName(supporter: Supporter): string {
  const trimmed = supporter.name?.trim() ?? '';
  return !trimmed || isGenericName(trimmed) ? 'A quiet supporter' : trimmed;
}

/** "$25", "$1,050", "$7.50" — whole dollars drop the cents. */
export function formatTotal(total: number): string {
  const isWhole = Number.isInteger(total);
  return `$${total.toLocaleString('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
