import { describe, it, expect } from 'vitest';
import {
  computeChannelTypeBreakdown,
  computeGuildBreakdown,
  computeTimelineStats,
  computeTopChannels,
  parseDiscordTimestamp,
} from './packageAnalyticsUtils';
import { PACKAGE_CHANNEL_TYPE, type PackageChannel } from '@/features/package/packageTypes';

function makeChannel(partial: Partial<PackageChannel>): PackageChannel {
  return {
    id: partial.id ?? 'c1',
    type: partial.type ?? PACKAGE_CHANNEL_TYPE.GUILD_TEXT,
    name: partial.name ?? 'channel',
    messageCount: partial.messageCount ?? 0,
    isOrphan: partial.isOrphan ?? false,
    ...partial,
  };
}

describe('computeTopChannels', () => {
  it('sorts channels by messageCount descending', () => {
    const channels = [
      makeChannel({ id: 'a', messageCount: 10, name: 'low' }),
      makeChannel({ id: 'b', messageCount: 100, name: 'high' }),
      makeChannel({ id: 'c', messageCount: 50, name: 'mid' }),
    ];
    const top = computeTopChannels(channels, 10);
    expect(top.map((c) => c.channelId)).toEqual(['b', 'c', 'a']);
  });

  it('respects the limit argument', () => {
    const channels = Array.from({ length: 20 }, (_, i) =>
      makeChannel({ id: `c${i}`, messageCount: i }),
    );
    expect(computeTopChannels(channels, 5)).toHaveLength(5);
  });

  it('uses channel.name as label; falls back to DM label for DM channels', () => {
    const channels = [
      makeChannel({ id: 'a', type: PACKAGE_CHANNEL_TYPE.DM, name: null, messageCount: 5 }),
      makeChannel({ id: 'b', type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT, name: 'general', messageCount: 1 }),
    ];
    const top = computeTopChannels(channels, 10);
    expect(top.find((c) => c.channelId === 'a')?.label).toBe('Direct Message');
    expect(top.find((c) => c.channelId === 'b')?.label).toBe('general');
  });
});

describe('computeGuildBreakdown', () => {
  it('groups by guildId and sums message counts', () => {
    const channels = [
      makeChannel({ id: '1', guildId: 'g1', guildName: 'Guild A', messageCount: 10 }),
      makeChannel({ id: '2', guildId: 'g1', guildName: 'Guild A', messageCount: 20 }),
      makeChannel({ id: '3', guildId: 'g2', guildName: 'Guild B', messageCount: 5 }),
    ];
    const out = computeGuildBreakdown(channels);
    expect(out).toHaveLength(2);
    expect(out[0].guildName).toBe('Guild A');
    expect(out[0].messageCount).toBe(30);
    expect(out[0].channelCount).toBe(2);
  });

  it('groups all DMs under one "Direct Messages" bucket', () => {
    const channels = [
      makeChannel({ id: '1', type: PACKAGE_CHANNEL_TYPE.DM, messageCount: 5 }),
      makeChannel({ id: '2', type: PACKAGE_CHANNEL_TYPE.DM, messageCount: 10 }),
      makeChannel({ id: '3', type: PACKAGE_CHANNEL_TYPE.GROUP_DM, messageCount: 7 }),
    ];
    const out = computeGuildBreakdown(channels);
    expect(out).toHaveLength(1);
    expect(out[0].guildName).toBe('Direct Messages');
    expect(out[0].messageCount).toBe(22);
  });

  it('groups orphan channels under "Left servers"', () => {
    const channels = [
      makeChannel({ id: '1', isOrphan: true, messageCount: 3 }),
      makeChannel({ id: '2', isOrphan: true, messageCount: 4 }),
    ];
    const out = computeGuildBreakdown(channels);
    expect(out[0].guildName).toBe('Left servers');
    expect(out[0].messageCount).toBe(7);
  });
});

describe('computeChannelTypeBreakdown', () => {
  it('categorizes each channel type correctly', () => {
    const channels = [
      makeChannel({ type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT }),
      makeChannel({ type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT }),
      makeChannel({ type: PACKAGE_CHANNEL_TYPE.DM }),
      makeChannel({ type: PACKAGE_CHANNEL_TYPE.GROUP_DM }),
      makeChannel({ type: PACKAGE_CHANNEL_TYPE.GUILD_PUBLIC_THREAD }),
      makeChannel({ type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT, isOrphan: true }),
    ];
    const out = computeChannelTypeBreakdown(channels);
    expect(out).toEqual({ guildText: 2, dms: 1, groupDms: 1, threads: 1, orphans: 1 });
  });
});

describe('parseDiscordTimestamp', () => {
  it('parses the package timestamp format', () => {
    const d = parseDiscordTimestamp('2022-07-28 22:30:52.800000+00:00');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2022);
    expect(d?.getUTCMonth()).toBe(6); // July = index 6
    expect(d?.getUTCHours()).toBe(22);
  });

  it('returns null for empty or invalid strings', () => {
    expect(parseDiscordTimestamp('')).toBeNull();
    expect(parseDiscordTimestamp('not a date')).toBeNull();
  });
});

describe('computeTimelineStats', () => {
  it('returns zero/null stats for empty input', () => {
    const stats = computeTimelineStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byMonth).toEqual([]);
    expect(stats.peakMonth).toBeNull();
    expect(stats.peakHour).toBeNull();
  });

  it('buckets timestamps by month and year', () => {
    const stats = computeTimelineStats([
      '2022-07-01 00:00:00.000000+00:00',
      '2022-07-15 00:00:00.000000+00:00',
      '2022-08-01 00:00:00.000000+00:00',
      '2023-01-01 00:00:00.000000+00:00',
    ]);
    expect(stats.total).toBe(4);
    expect(stats.byMonth).toEqual([
      { key: '2022-07', count: 2 },
      { key: '2022-08', count: 1 },
      { key: '2023-01', count: 1 },
    ]);
    expect(stats.byYear).toEqual([
      { year: 2022, count: 3 },
      { year: 2023, count: 1 },
    ]);
  });

  it('identifies peak month and peak hour', () => {
    const stats = computeTimelineStats([
      '2022-07-01 22:00:00.000000+00:00',
      '2022-07-02 22:00:00.000000+00:00',
      '2022-07-03 22:00:00.000000+00:00',
      '2022-08-01 05:00:00.000000+00:00',
    ]);
    expect(stats.peakMonth?.key).toBe('2022-07');
    expect(stats.peakMonth?.count).toBe(3);
    expect(stats.peakHour?.hour).toBe(22);
    expect(stats.peakHour?.count).toBe(3);
  });

  it('tracks first and last timestamps', () => {
    const stats = computeTimelineStats([
      '2023-01-01 12:00:00.000000+00:00',
      '2022-07-28 22:30:52.800000+00:00',
      '2022-12-15 10:00:00.000000+00:00',
    ]);
    expect(stats.firstTimestamp).toBe('2022-07-28 22:30:52.800000+00:00');
    expect(stats.lastTimestamp).toBe('2023-01-01 12:00:00.000000+00:00');
  });

  it('skips invalid timestamps', () => {
    const stats = computeTimelineStats([
      '2022-07-28 22:30:52.800000+00:00',
      'garbage',
      '',
    ]);
    expect(stats.total).toBe(1);
  });
});
