import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import BulkPurgeDialog from './BulkPurgeDialog';
import type { Channel } from 'discrub-core/types/discord-types';
import { ChannelType } from 'discrub-core/discord-enum';
import { createAuthenticatedState } from '@/test/state-factories';
import { bulkPurgeChannels, bulkPurgeDMs } from '@features/purge/purgeSlice';

vi.mock('@features/purge/purgeSlice', async () => {
  const actual = await vi.importActual('@features/purge/purgeSlice');
  return {
    ...actual,
    bulkPurgeChannels: vi.fn(() => ({ type: 'purge/bulkPurgeChannels/mock' })),
    bulkPurgeDMs: vi.fn(() => ({ type: 'purge/bulkPurgeDMs/mock' })),
  };
});

const mockChannels: Channel[] = [
  { id: '1', name: 'general', type: ChannelType.GUILD_TEXT } as Channel,
  { id: '2', name: 'random', type: ChannelType.GUILD_TEXT } as Channel,
  { id: '3', name: 'dev-chat', type: ChannelType.GUILD_TEXT } as Channel,
];

const mockDms: Channel[] = [
  { id: '10', type: 4, recipients: [{ id: '100', username: 'Alice' }] } as unknown as Channel,
  { id: '11', type: 4, recipients: [{ id: '101', username: 'Bob' }] } as unknown as Channel,
];

const stateWithUser = {
  ...createAuthenticatedState(),
  user: {
    currentUser: { id: '999', username: 'testuser', discriminator: '0', global_name: 'Test User', avatar: null },
    isLoading: false,
    error: null,
  },
  cache: {
    isLoaded: true,
    userMap: {
      '999': { userName: 'testuser', displayName: 'Test User', avatar: null, guilds: {}, timestamp: 1 },
      '888': { userName: 'otheruser', displayName: 'Other User', avatar: null, guilds: {}, timestamp: 1 },
    },
    failedUserIds: [],
  },
};

describe('BulkPurgeDialog', () => {
  describe('Channel mode', () => {
    it('renders dialog title with channel count', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText('Purge Channels')).toBeInTheDocument();
      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    it('renders compact channel summary with first names + "more" suffix', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      // Summary pill shows count + first few names inline
      expect(screen.getByText('3 channels')).toBeInTheDocument();
      expect(screen.getByText(/# general.*# random.*# dev-chat/)).toBeInTheDocument();
    });

    it('expands channel list when summary is clicked', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Selected channels' }));
      expect(screen.getByText('# general')).toBeInTheDocument();
      expect(screen.getByText('# random')).toBeInTheDocument();
      expect(screen.getByText('# dev-chat')).toBeInTheDocument();
    });

    it('shows +N suffix when there are more than 3 channels', () => {
      const manyChannels = [
        ...mockChannels,
        { id: '4', name: 'support', type: ChannelType.GUILD_TEXT } as Channel,
        { id: '5', name: 'news', type: ChannelType.GUILD_TEXT } as Channel,
      ];
      renderWithProviders(
        <BulkPurgeDialog open channels={manyChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    });

    it('defaults to Messages mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByRole('button', { name: 'Messages' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Attachments Only' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Reactions' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows all 4 mode buttons when canManageMessages is true', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByRole('button', { name: 'Messages' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Attachments Only' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reactions' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear All Reactions' })).toBeInTheDocument();
    });

    it('hides Clear All Reactions without canManageMessages but still shows Attachments Only', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByRole('button', { name: 'Attachments Only' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear All Reactions' })).not.toBeInTheDocument();
    });

    it('shows Target messages section with Add filters affordance in Messages mode (#112)', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText('Target messages')).toBeInTheDocument();
      // Guild Messages mode: filter modal replaces the old top-level
      // author picker — the button is the entry point.
      expect(screen.getByRole('button', { name: 'Add filters' })).toBeInTheDocument();
    });

    it('does not pre-select any user', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      // No user chips should be shown initially
      expect(screen.queryByText('Test User (You)')).not.toBeInTheDocument();
    });

    it('shows filter-modal helper text in Messages mode for server context', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      // The filter modal replaces the old picker and owns the guidance.
      expect(screen.getByText(/Open filters to pick the target author/)).toBeInTheDocument();
    });

    it('shows Retain-media checkbox only in Messages mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByLabelText('Clear text, keep attachments')).toBeInTheDocument();
    });

    it('hides Retain-media checkbox when Attachments Only mode is selected', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Attachments Only' }));
      expect(screen.queryByLabelText('Clear text, keep attachments')).not.toBeInTheDocument();
    });

    it('does NOT render old "Advanced Options" or "Delete attachments only" UI', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.queryByText('Advanced Options')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Delete attachments only')).not.toBeInTheDocument();
    });

    it('switches to Reactions mode — top-level reactor picker returns, filter modal exits', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      // Reactions keeps its top-level picker (reactor semantic ≠ author).
      // The Add-filters button is now also exposed for optional message-
      // narrowing (orthogonal to the reactor picker) — see issue trailer
      // "Reactions: unchanged — keeps its own picker … Deferred: adding
      //  optional message-narrowing filters to Reactions mode".
      expect(screen.getByText('Remove reactions from')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add filters' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Clear text, keep attachments')).not.toBeInTheDocument();
    });

    it('hides Target section but still exposes filters in Clear All Reactions mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Clear All Reactions' }));
      expect(screen.queryByText('Target messages')).not.toBeInTheDocument();
      // No reactor picker — but filters stay available for message-narrowing
      expect(screen.getByRole('button', { name: 'Add filters' })).toBeInTheDocument();
    });

    it('shows irreversible warning', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText('This action is irreversible.')).toBeInTheDocument();
    });

    it('shows correct summary text for Messages mode with no users selected', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText(/3 channels will be purged. Messages from 0 users will be permanently deleted/)).toBeInTheDocument();
    });

    it('shows correct summary text for Attachments Only mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Attachments Only' }));
      expect(screen.getByText(/Attachments will be stripped.*Message text is preserved/)).toBeInTheDocument();
    });

    it('shows correct summary text for Reactions mode without MANAGE (self-locked)', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      // Without MANAGE_MESSAGES the target is locked to the current user (1).
      expect(screen.getByText(/Reactions from 1 user will be removed across 3 channels/)).toBeInTheDocument();
    });

    it('confirm button shows channel count', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByRole('button', { name: /Purge 3 Ch\.s/ })).toBeInTheDocument();
    });

    it('confirm button shows "Strip Attachments" label in Attachments Only mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Attachments Only' }));
      expect(screen.getByRole('button', { name: /Strip Attachments \(3 Ch\.s\)/ })).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={onClose} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('disables confirm button when no users are selected in Messages mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByRole('button', { name: /Purge 3 Ch\.s/ })).toBeDisabled();
    });
  });

  describe('DM mode', () => {
    it('renders dialog title for DMs', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText('Purge DMs')).toBeInTheDocument();
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('shows compact DM summary without # prefix', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText('2 conversations')).toBeInTheDocument();
      expect(screen.getByText(/Alice.*Bob/)).toBeInTheDocument();
    });

    it('shows DM restriction info in Messages mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText(/Only your own messages can be targeted in DMs/)).toBeInTheDocument();
    });

    it('uses "conversation" terminology in summary', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText(/2 conversations will be purged/)).toBeInTheDocument();
    });

    it('confirm button shows DM count', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByRole('button', { name: /Purge 2 DMs/ })).toBeInTheDocument();
    });

    it('locks UserPicker in DM messages mode (no autocomplete input)', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      // Disabled UserPicker hides the combobox
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('locks UserPicker to current user in DM reactions mode (no MANAGE_MESSAGES)', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      expect(screen.getByText(/only remove your own reactions/)).toBeInTheDocument();
    });
  });

  describe('Single channel', () => {
    it('uses singular terminology for 1 channel', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={[mockChannels[0]]} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.getByText(/1 channel will be purged/)).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
  });

  describe('Not rendered when closed', () => {
    it('does not render content when open is false', () => {
      renderWithProviders(
        <BulkPurgeDialog open={false} channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      expect(screen.queryByText('Purge Channels')).not.toBeInTheDocument();
    });
  });

  describe('Dispatch wiring', () => {
    beforeEach(() => {
      vi.mocked(bulkPurgeChannels).mockClear();
      vi.mocked(bulkPurgeDMs).mockClear();
    });

    it('dispatches bulkPurgeChannels with Reactions config when confirmed', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));

      // Open the autocomplete and select the current user
      const input = screen.getByRole('combobox');
      fireEvent.mouseDown(input);

      const options = screen.getAllByRole('option');
      fireEvent.click(options[0]);

      const confirmButton = screen.getByRole('button', { name: /Remove Reactions/ });
      expect(confirmButton).not.toBeDisabled();
      fireEvent.click(confirmButton);

      expect(bulkPurgeChannels).toHaveBeenCalledTimes(1);
      expect(bulkPurgeChannels).toHaveBeenCalledWith({
        channels: mockChannels,
        config: {
          mode: 'reactions',
          targetUserIds: ['999'],
          retainAttachedMedia: false,
          deleteAttachmentsOnly: false,
        },
        guildId: 'g1',
        // Reactions mode doesn't narrow messages via FilterModal (yet).
        searchCriteria: null,
      });
      expect(bulkPurgeDMs).not.toHaveBeenCalled();
    });

    it('dispatches bulkPurgeDMs when confirm is clicked in DM messages mode', () => {
      const onClose = vi.fn();
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={onClose} mode="dms" />,
        { preloadedState: stateWithUser },
      );

      const confirmButton = screen.getByRole('button', { name: /Purge 2 DMs/ });
      expect(confirmButton).not.toBeDisabled();
      fireEvent.click(confirmButton);

      expect(bulkPurgeDMs).toHaveBeenCalledTimes(1);
      expect(bulkPurgeDMs).toHaveBeenCalledWith({
        channels: mockDms,
        config: {
          mode: 'messages',
          targetUserIds: ['999'],
          retainAttachedMedia: false,
          deleteAttachmentsOnly: false,
        },
        // DM messages mode exposes the optional filter row but sends null
        // when the user hasn't opened/applied it.
        searchCriteria: null,
      });
      expect(bulkPurgeChannels).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('dispatches Attachments Only mode as {mode: messages, deleteAttachmentsOnly: true}', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Attachments Only' }));

      const confirmButton = screen.getByRole('button', { name: /Strip Attachments \(2 DMs\)/ });
      expect(confirmButton).not.toBeDisabled();
      fireEvent.click(confirmButton);

      expect(bulkPurgeDMs).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            mode: 'messages',
            retainAttachedMedia: false,
            deleteAttachmentsOnly: true,
          }),
        }),
      );
    });

    it('dispatches Messages mode with retainAttachedMedia when the checkbox is toggled', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" />,
        { preloadedState: stateWithUser },
      );

      fireEvent.click(screen.getByLabelText('Clear text, keep attachments'));
      const confirmButton = screen.getByRole('button', { name: /Purge 2 DMs/ });
      fireEvent.click(confirmButton);

      expect(bulkPurgeDMs).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            mode: 'messages',
            retainAttachedMedia: true,
            deleteAttachmentsOnly: false,
          }),
        }),
      );
    });

    it('dispatches Clear All Reactions config', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Clear All Reactions' }));

      const confirmButton = screen.getByRole('button', { name: /Clear Reactions/ });
      expect(confirmButton).not.toBeDisabled();
      fireEvent.click(confirmButton);

      expect(bulkPurgeChannels).toHaveBeenCalledWith({
        channels: mockChannels,
        config: {
          mode: 'clearReactions',
          targetUserIds: [],
          retainAttachedMedia: false,
          deleteAttachmentsOnly: false,
        },
        guildId: 'g1',
        searchCriteria: null,
      });
    });

    it('does not export PurgeMode from BulkPurgeDialog (only default export)', async () => {
      const bulkPurgeDialogExports = await import('./BulkPurgeDialog');
      const exportKeys = Object.keys(bulkPurgeDialogExports).filter((k) => k !== 'default');
      expect(exportKeys).not.toContain('PurgeMode');
    });

    it('keeps confirm button disabled in guild Messages mode until filters set an author (#112)', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      // With no filter applied the target is empty → purge disabled.
      expect(screen.getByRole('button', { name: /Purge 3 Ch\.s/ })).toBeDisabled();
      // Filter modal button is the entry point for setting targets.
      expect(screen.getByRole('button', { name: 'Add filters' })).toBeInTheDocument();
    });
  });

  describe('Reactions mode permission enforcement', () => {
    it('shows unrestricted UserPicker in Reactions mode with canManageMessages', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      expect(screen.getByText('Remove reactions from')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).not.toBeDisabled();
    });

    it('shows locked UserPicker in Reactions mode without canManageMessages', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      expect(screen.getByText(/only remove your own reactions/)).toBeInTheDocument();
    });

    it('dispatches with current user ID in Reactions mode without canManageMessages', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      const confirmButton = screen.getByRole('button', { name: /Remove Reactions/ });
      fireEvent.click(confirmButton);
      expect(bulkPurgeChannels).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            mode: 'reactions',
            targetUserIds: ['999'],
          }),
        }),
      );
    });
  });

  describe('Clear All Reactions mode (MANAGE_MESSAGES)', () => {
    it('confirm button is enabled without user selection in clearReactions mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Clear All Reactions' }));
      expect(screen.getByRole('button', { name: /Clear Reactions/ })).not.toBeDisabled();
    });

    it('summary text reflects Clear All Reactions mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Clear All Reactions' }));
      expect(screen.getByText(/All reactions will be removed from every message/)).toBeInTheDocument();
    });
  });

  describe('FilterModal hideAuthorFilters wiring (Backlog #137)', () => {
    const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Add filters' }));

    it('hides Search From + Author Type when DM mode is in Messages family', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" guildId={null} />,
        { preloadedState: stateWithUser },
      );
      // Default uiMode for DM is "messages" — target is locked to self,
      // so the FilterModal opens with author fields hidden.
      openFilters();
      expect(screen.queryByTestId('filter-modal-search-from')).toBeNull();
      expect(screen.queryByTestId('filter-modal-search-author-type')).toBeNull();
    });

    it('hides Search From + Author Type when DM mode is Attachments Only', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" guildId={null} />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Attachments Only' }));
      openFilters();
      expect(screen.queryByTestId('filter-modal-search-from')).toBeNull();
      expect(screen.queryByTestId('filter-modal-search-author-type')).toBeNull();
    });

    it('KEEPS Search From + Author Type visible in DM Reactions mode (regression guard)', () => {
      // Critical: in DM Reactions, the reactor is locked but the
      // message-author filter is independent. Hiding From here would
      // silently break the "remove my reactions only from the other
      // person's messages" workflow.
      renderWithProviders(
        <BulkPurgeDialog open channels={mockDms} onClose={vi.fn()} mode="dms" guildId={null} />,
        { preloadedState: stateWithUser },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
      openFilters();
      expect(screen.getByTestId('filter-modal-search-from')).toBeInTheDocument();
      expect(screen.getByTestId('filter-modal-search-author-type')).toBeInTheDocument();
    });

    it('keeps Search From + Author Type visible in any guild mode', () => {
      renderWithProviders(
        <BulkPurgeDialog open channels={mockChannels} onClose={vi.fn()} mode="channels" guildId="g1" canManageMessages />,
        { preloadedState: stateWithUser },
      );
      // Guild Messages — author isn't locked.
      openFilters();
      expect(screen.getByTestId('filter-modal-search-from')).toBeInTheDocument();
      expect(screen.getByTestId('filter-modal-search-author-type')).toBeInTheDocument();
    });
  });
});
