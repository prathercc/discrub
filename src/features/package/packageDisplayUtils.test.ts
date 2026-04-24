import { describe, it, expect } from 'vitest';
import {
  getPackageChannelLabel,
  getPackageChannelSubtitle,
  stripLegacyDiscriminator,
} from './packageDisplayUtils';
import { PACKAGE_CHANNEL_TYPE, type PackageChannel } from './packageTypes';

const base: PackageChannel = {
  id: '1',
  type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT,
  name: 'general',
  messageCount: 0,
  isOrphan: false,
};

describe('stripLegacyDiscriminator', () => {
  it('removes trailing #0 suffix', () => {
    expect(stripLegacyDiscriminator('drewology#0')).toBe('drewology');
    expect(stripLegacyDiscriminator('Direct Message with drewology#0')).toBe(
      'Direct Message with drewology',
    );
  });

  it('leaves real discriminators (#NNNN) alone', () => {
    expect(stripLegacyDiscriminator('someone#1234')).toBe('someone#1234');
  });

  it('leaves #0 in the middle alone', () => {
    expect(stripLegacyDiscriminator('Channel #0-general')).toBe('Channel #0-general');
  });
});

describe('getPackageChannelLabel', () => {
  it('returns guild channel name as-is', () => {
    expect(getPackageChannelLabel({ ...base, name: 'general' })).toBe('general');
  });

  it('strips "Direct Message with" prefix and #0 suffix', () => {
    expect(
      getPackageChannelLabel({
        ...base,
        type: PACKAGE_CHANNEL_TYPE.DM,
        name: 'Direct Message with drewology#0',
      }),
    ).toBe('drewology');
  });

  it('strips "Direct Message with" prefix when no discriminator present', () => {
    expect(
      getPackageChannelLabel({
        ...base,
        type: PACKAGE_CHANNEL_TYPE.DM,
        name: 'Direct Message with tester-friend',
      }),
    ).toBe('tester-friend');
  });

  it('falls back to "Direct Message" for unnamed DMs', () => {
    expect(
      getPackageChannelLabel({
        ...base,
        type: PACKAGE_CHANNEL_TYPE.DM,
        name: null,
      }),
    ).toBe('Direct Message');
  });

  it('falls back to channel ID for unnamed guild channels', () => {
    expect(
      getPackageChannelLabel({ ...base, name: null, id: '12345' }),
    ).toBe('12345');
  });

  it('falls back to "Group DM" for unnamed group DMs', () => {
    expect(
      getPackageChannelLabel({
        ...base,
        type: PACKAGE_CHANNEL_TYPE.GROUP_DM,
        name: null,
      }),
    ).toBe('Group DM');
  });
});

describe('getPackageChannelSubtitle', () => {
  it('shows "Left server" for orphans with a name', () => {
    expect(
      getPackageChannelSubtitle({ ...base, isOrphan: true, name: 'general' }),
    ).toBe('Left server');
  });

  it('appends channel ID for unnamed orphan channels', () => {
    expect(
      getPackageChannelSubtitle({ ...base, isOrphan: true, name: null, id: '42' }),
    ).toBe('Left server · 42');
  });

  it('shows guild name when available', () => {
    expect(getPackageChannelSubtitle({ ...base, guildName: 'Guild A' })).toBe(
      'Guild A',
    );
  });

  it('shows "Direct Message" for nameless DMs', () => {
    expect(
      getPackageChannelSubtitle({
        ...base,
        type: PACKAGE_CHANNEL_TYPE.DM,
        guildName: undefined,
      }),
    ).toBe('Direct Message');
  });
});
