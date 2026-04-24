import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import UserPicker from './UserPicker';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';
import { createAuthenticatedState } from '@/test/state-factories';

// Mock the discord service
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    getUser: vi.fn(),
  })),
}));

import { getDiscordService } from '@services/discordService';

const mockCachedUserMap: ExportUserMap = {
  '111': { userName: 'alice', displayName: 'Alice', avatar: null, guilds: {}, timestamp: 1 },
  '222': { userName: 'bob', displayName: 'Bob', avatar: null, guilds: {}, timestamp: 1 },
  '333': { userName: 'charlie', displayName: 'Charlie', avatar: null, guilds: {}, timestamp: 1 },
};

const defaultProps = {
  selectedUserIds: ['111'],
  onChange: vi.fn(),
  cachedUserMap: mockCachedUserMap,
  currentUserId: '111',
  label: 'Select users',
};

const authenticatedState = createAuthenticatedState();

describe('UserPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders label', () => {
      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });
      expect(screen.getByText('Select users')).toBeInTheDocument();
    });

    it('renders custom label', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} label="Whose messages?" />,
        { preloadedState: authenticatedState },
      );
      expect(screen.getByText('Whose messages?')).toBeInTheDocument();
    });

    it('omits label when label is empty string', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} label="" />,
        { preloadedState: authenticatedState },
      );
      // No visible label above the input
      expect(screen.queryByText('Select users')).not.toBeInTheDocument();
    });

    it('renders selected user chips', () => {
      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });
      expect(screen.getByText('Alice (You)')).toBeInTheDocument();
    });

    it('renders multiple selected user chips', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} selectedUserIds={['111', '222']} />,
        { preloadedState: authenticatedState },
      );
      expect(screen.getByText('Alice (You)')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders search-or-ID placeholder reflecting both supported input modes', () => {
      // Updated copy makes cached-user search discoverable — previously
      // the placeholder said "Paste Discord User ID" which hid the
      // typing-to-search affordance.
      renderWithProviders(
        <UserPicker {...defaultProps} selectedUserIds={[]} />,
        { preloadedState: authenticatedState },
      );
      expect(screen.getByPlaceholderText('Type to search or paste a User ID')).toBeInTheDocument();
    });

    it('shows ID-only helper text below the input', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} selectedUserIds={[]} />,
        { preloadedState: authenticatedState },
      );
      expect(screen.getByText(/right-click a user in Discord.*Copy User ID/i)).toBeInTheDocument();
    });
  });

  describe('Disabled mode', () => {
    it('hides autocomplete when disabled', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} disabled />,
        { preloadedState: authenticatedState },
      );
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('shows selected users as read-only chips (no delete button)', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} disabled />,
        { preloadedState: authenticatedState },
      );
      expect(screen.getByText('Alice (You)')).toBeInTheDocument();
      const chips = screen.getAllByRole('generic').filter(
        (el) => el.classList.contains('MuiChip-root')
      );
      chips.forEach((chip) => {
        expect(chip.querySelector('.MuiChip-deleteIcon')).toBeNull();
      });
    });
  });

  describe('User removal', () => {
    it('calls onChange without removed user when chip delete is clicked', () => {
      const onChange = vi.fn();
      renderWithProviders(
        <UserPicker {...defaultProps} selectedUserIds={['111', '222']} onChange={onChange} />,
        { preloadedState: authenticatedState },
      );
      const bobChip = screen.getByText('Bob').closest('.MuiChip-root');
      const deleteButton = bobChip?.querySelector('.MuiChip-deleteIcon');
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(onChange).toHaveBeenCalledWith(['111']);
      }
    });
  });

  describe('ID lookup via autocomplete', () => {
    it('shows "Look up ID" option only for numeric input', () => {
      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '444' } });
      expect(screen.getByText(/Look up ID "444"/)).toBeInTheDocument();
    });

    it('does NOT show "Look up" option for non-numeric input', () => {
      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'emma' } });
      // Only cached-user filtering happens; no lookup affordance for non-numeric
      expect(screen.queryByText(/Look up/)).not.toBeInTheDocument();
    });

    it('calls getUser when lookup option is clicked', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { id: '444', username: 'diana', global_name: 'Diana', avatar: null },
      });
      (getDiscordService as ReturnType<typeof vi.fn>).mockReturnValue({
        getUser: mockGetUser,
      });

      const onChange = vi.fn();
      renderWithProviders(
        <UserPicker {...defaultProps} onChange={onChange} />,
        { preloadedState: authenticatedState },
      );

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '444' } });

      const lookupOption = screen.getByText(/Look up ID "444"/);
      fireEvent.click(lookupOption);

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalledWith(expect.any(String), '444');
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(['111', '444']);
      });
    });

    it('shows "User not found" for 404 lookup', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({ success: false, status: 404, data: undefined });
      (getDiscordService as ReturnType<typeof vi.fn>).mockReturnValue({ getUser: mockGetUser });

      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '999999' } });
      fireEvent.click(screen.getByText(/Look up ID "999999"/));

      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument();
      });
    });

    it('shows "Access denied" for 403 lookup', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({ success: false, status: 403, data: undefined });
      (getDiscordService as ReturnType<typeof vi.fn>).mockReturnValue({ getUser: mockGetUser });

      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '888888' } });
      fireEvent.click(screen.getByText(/Look up ID "888888"/));

      await waitFor(() => {
        expect(screen.getByText('Access denied for this user')).toBeInTheDocument();
      });
    });

    it('shows generic error for 500 lookup', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({ success: false, status: 500, data: undefined });
      (getDiscordService as ReturnType<typeof vi.fn>).mockReturnValue({ getUser: mockGetUser });

      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: authenticatedState });

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '777777' } });
      fireEvent.click(screen.getByText(/Look up ID "777777"/));

      await waitFor(() => {
        expect(screen.getByText('Lookup failed. Please try again.')).toBeInTheDocument();
      });
    });

    it('skips lookup for previously-failed user IDs', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({ success: true, status: 200, data: { id: '999999', username: 'test', global_name: 'Test', avatar: null } });
      (getDiscordService as ReturnType<typeof vi.fn>).mockReturnValue({ getUser: mockGetUser });

      // Pre-populate failedUserIds in state
      const stateWithFailed = {
        ...authenticatedState,
        cache: { ...authenticatedState.cache, failedUserIds: ['999999'], isLoaded: true },
      };

      renderWithProviders(<UserPicker {...defaultProps} />, { preloadedState: stateWithFailed });

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '999999' } });
      fireEvent.click(screen.getByText(/Look up ID "999999"/));

      await waitFor(() => {
        // Should show cached error without making API call
        expect(screen.getByText('User not found (previously looked up)')).toBeInTheDocument();
      });

      // getUser should NOT have been called
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate prevention', () => {
    it('does not add already-selected user again', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { id: '111', username: 'alice', global_name: 'Alice', avatar: null },
      });
      (getDiscordService as ReturnType<typeof vi.fn>).mockReturnValue({ getUser: mockGetUser });

      const onChange = vi.fn();
      renderWithProviders(
        <UserPicker {...defaultProps} onChange={onChange} />,
        { preloadedState: authenticatedState },
      );

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: '111' } });
      fireEvent.click(screen.getByText(/Look up ID "111"/));

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalled();
      });

      // onChange should not be called since user is already selected
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Uncached user display', () => {
    it('displays user ID as fallback when user is not in cache', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} selectedUserIds={['111', '999']} />,
        { preloadedState: authenticatedState },
      );
      expect(screen.getByText('Alice (You)')).toBeInTheDocument();
      expect(screen.getByText('999')).toBeInTheDocument();
    });
  });

  describe('Cached user filtering', () => {
    it('filters cached users by display name when typing', () => {
      renderWithProviders(
        <UserPicker {...defaultProps} selectedUserIds={[]} />,
        { preloadedState: authenticatedState },
      );
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'Ali' } });
      // Alice should appear in dropdown
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Duplicate display names', () => {
    it('does not emit duplicate-key warnings when two users share a displayName', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const dupeMap: ExportUserMap = {
        '111': { userName: 'luke.abc', displayName: 'Luke', avatar: null, guilds: {}, timestamp: 1 },
        '222': { userName: 'luke.xyz', displayName: 'Luke', avatar: null, guilds: {}, timestamp: 1 },
        '333': { userName: 'zan1', displayName: 'Zan', avatar: null, guilds: {}, timestamp: 1 },
        '444': { userName: 'zan2', displayName: 'Zan', avatar: null, guilds: {}, timestamp: 1 },
      };
      renderWithProviders(
        <UserPicker {...defaultProps} cachedUserMap={dupeMap} selectedUserIds={[]} currentUserId="" />,
        { preloadedState: authenticatedState },
      );
      const input = screen.getByRole('combobox');
      fireEvent.mouseDown(input);

      const keyWarnings = errorSpy.mock.calls.filter((call) => {
        const first = call[0];
        return typeof first === 'string' && first.includes('same key');
      });
      expect(keyWarnings).toHaveLength(0);
      errorSpy.mockRestore();
    });
  });
});
