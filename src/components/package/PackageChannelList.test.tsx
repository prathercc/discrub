import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import PackageChannelList from './PackageChannelList';
import { initialPackageState } from '@features/package/packageSlice';
import {
  PACKAGE_CHANNEL_TYPE,
  type PackageChannel,
  type ParsedPackage,
} from '@features/package/packageTypes';

const purgedChannel: PackageChannel = {
  id: '200',
  type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT,
  name: 'general',
  guildId: 'g1',
  guildName: 'Guild A',
  messageCount: 80000,
  isOrphan: false,
};

const untouchedChannel: PackageChannel = {
  id: '201',
  type: PACKAGE_CHANNEL_TYPE.GUILD_TEXT,
  name: 'random',
  guildId: 'g1',
  guildName: 'Guild A',
  messageCount: 5,
  isOrphan: false,
};

const parsed: ParsedPackage = {
  user: { id: 'u1', username: 'tester', globalName: 'Tester', avatarHash: null },
  guilds: [{ id: 'g1', name: 'Guild A' }],
  channels: [purgedChannel, untouchedChannel],
  totalMessages: 80005,
  packageSizeBytes: 1,
};

function statePackageLoaded(
  deletedMessageIds: Record<string, string[]> = {},
) {
  return {
    package: {
      ...initialPackageState,
      status: 'ready',
      parsed,
      validation: { ok: true, readOnly: false, warnings: [], errors: [] },
      deletedMessageIds,
    },
  } as never;
}

describe('<PackageChannelList /> — #236 live remaining counts', () => {
  it('renders the archive count untouched when no deletions exist', () => {
    renderWithProviders(<PackageChannelList />, {
      preloadedState: statePackageLoaded(),
    });
    expect(screen.getByText('80,000')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('subtracts deleted-via-Discrub ids from the displayed count', () => {
    renderWithProviders(<PackageChannelList />, {
      preloadedState: statePackageLoaded({ '200': ['1', '2', '3'] }),
    });
    // 80,000 in the archive minus 3 confirmed-gone.
    expect(screen.getByText('79,997')).toBeInTheDocument();
    expect(screen.queryByText('80,000')).not.toBeInTheDocument();
    // Untouched sibling keeps its raw archive count.
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('explains the adjustment in a tooltip on the count caption', async () => {
    renderWithProviders(<PackageChannelList />, {
      preloadedState: statePackageLoaded({ '200': ['1', '2', '3'] }),
    });
    fireEvent.mouseOver(screen.getByText('79,997'));
    expect(
      await screen.findByText('80,000 in package, 3 deleted via Discrub'),
    ).toBeInTheDocument();
  });

  it('does not attach a tooltip when a channel has no deletions', () => {
    renderWithProviders(<PackageChannelList />, {
      preloadedState: statePackageLoaded({ '200': ['1'] }),
    });
    const untouched = screen.getByText('5');
    expect(untouched).not.toHaveAttribute('aria-label');
    fireEvent.mouseOver(untouched);
    expect(
      screen.queryByText(/in package, .* deleted via Discrub/),
    ).not.toBeInTheDocument();
  });
});
