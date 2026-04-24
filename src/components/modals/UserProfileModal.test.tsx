import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import UserProfileModal from './UserProfileModal';
import { createMockUser } from '../../test/fixtures';
import { renderWithProviders } from '../../test/test-utils';

describe('UserProfileModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    user: createMockUser({ id: 'u1', username: 'testuser', discriminator: '1234', avatar: 'abc123' }),
    cachedUserMap: {},
    guildId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Rendering', () => {
    it('should render dialog when open', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.getByText('testuser#1234')).toBeInTheDocument();
    });

    it('should not render when user is null', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} user={null} />);
      expect(screen.queryByText('testuser')).toBeNull();
    });

    it('should not render when closed', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} open={false} />);
      expect(screen.queryByText('testuser')).toBeNull();
    });

    it('should render Close button', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('should call onClose when Close is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<UserProfileModal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('User Information', () => {
    it('should display user ID', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.getByText('u1')).toBeInTheDocument();
    });

    it('should display NAMES section', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.getByText('NAMES')).toBeInTheDocument();
    });

    it('should display ACCOUNT DETAILS section', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.getByText('ACCOUNT DETAILS')).toBeInTheDocument();
    });

    it('should display PROFILE CUSTOMIZATION section', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.getByText('PROFILE CUSTOMIZATION')).toBeInTheDocument();
    });
  });

  describe('Bot Badge', () => {
    it('should show BOT chip for bot users', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ bot: true })} />);
      expect(screen.getByText('BOT')).toBeInTheDocument();
    });

    it('should not show BOT chip for regular users', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.queryByText('BOT')).toBeNull();
    });
  });

  describe('Premium Status', () => {
    it('should show Nitro label for premium type 2', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ premium_type: 2 })} />);
      expect(screen.getByText('Nitro')).toBeInTheDocument();
    });

    it('should show Nitro Classic label for premium type 1', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ premium_type: 1 })} />);
      expect(screen.getByText('Nitro Classic')).toBeInTheDocument();
    });

    it('should show None label for premium type 0', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ premium_type: 0 })} />);
      // "None" appears in Nitro Status chip and Avatar Decoration text
      const noneElements = screen.getAllByText('None');
      expect(noneElements.length).toBeGreaterThanOrEqual(1);
      // The Nitro Status chip is within a MuiChip
      const chipNone = noneElements.find((el) => el.closest('.MuiChip-root'));
      expect(chipNone).toBeDefined();
    });
  });

  describe('Badges', () => {
    it('should show badge chips for users with flags', () => {
      // STAFF flag = 1
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ public_flags: 1 })} />);
      expect(screen.getByText('BADGES')).toBeInTheDocument();
      expect(screen.getByText('Discord Staff')).toBeInTheDocument();
    });

    it('should show multiple badges', () => {
      // STAFF(1) + BUG_HUNTER_LEVEL_1(8) = 9
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ public_flags: 9 })} />);
      expect(screen.getByText('Discord Staff')).toBeInTheDocument();
      expect(screen.getByText('Bug Hunter Level 1')).toBeInTheDocument();
    });

    it('should not show BADGES section when no flags', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} user={createMockUser({ public_flags: 0 })} />);
      expect(screen.queryByText('BADGES')).toBeNull();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy user ID when copy button is clicked', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      // There are copy buttons; find the one near the user ID
      const copyButtons = screen.getAllByRole('button').filter(
        (btn) => btn.querySelector('[data-testid="ContentCopyIcon"]')
      );
      expect(copyButtons.length).toBeGreaterThan(0);
      fireEvent.click(copyButtons[0]);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('Server Nickname', () => {
    it('should show Server Nickname row when guildId is provided', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} guildId="guild-1" />);
      expect(screen.getByText('Server Nickname')).toBeInTheDocument();
    });

    it('should not show Server Nickname row when no guildId', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} guildId={null} />);
      expect(screen.queryByText('Server Nickname')).toBeNull();
    });
  });

  describe('Quick filter actions (#129)', () => {
    it('renders neither filter button when no callbacks provided (TopBar case)', () => {
      renderWithProviders(<UserProfileModal {...defaultProps} />);
      expect(screen.queryByTestId('user-profile-filter-actions')).toBeNull();
      expect(screen.queryByRole('button', { name: /filter messages by/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /mentioning/i })).toBeNull();
    });

    it('renders the author button when onFilterByAuthor is provided', () => {
      const onFilter = vi.fn();
      renderWithProviders(
        <UserProfileModal {...defaultProps} onFilterByAuthor={onFilter} />,
      );
      expect(
        screen.getByRole('button', { name: /filter messages by testuser/i }),
      ).toBeInTheDocument();
    });

    it('renders the mentions button when onFilterByMentions is provided', () => {
      const onFilter = vi.fn();
      renderWithProviders(
        <UserProfileModal {...defaultProps} onFilterByMentions={onFilter} />,
      );
      expect(
        screen.getByRole('button', { name: /filter messages mentioning testuser/i }),
      ).toBeInTheDocument();
    });

    it('renders both side-by-side when both callbacks provided', () => {
      renderWithProviders(
        <UserProfileModal
          {...defaultProps}
          onFilterByAuthor={vi.fn()}
          onFilterByMentions={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-profile-filter-actions')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /filter messages by testuser/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /filter messages mentioning testuser/i }),
      ).toBeInTheDocument();
    });

    it('clicking the author button calls onFilterByAuthor with the user', () => {
      const onFilter = vi.fn();
      renderWithProviders(
        <UserProfileModal {...defaultProps} onFilterByAuthor={onFilter} />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: /filter messages by testuser/i }),
      );
      expect(onFilter).toHaveBeenCalledTimes(1);
      expect(onFilter).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', username: 'testuser' }),
      );
    });

    it('clicking the mentions button calls onFilterByMentions with the user', () => {
      const onFilter = vi.fn();
      renderWithProviders(
        <UserProfileModal {...defaultProps} onFilterByMentions={onFilter} />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: /filter messages mentioning testuser/i }),
      );
      expect(onFilter).toHaveBeenCalledTimes(1);
      expect(onFilter).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', username: 'testuser' }),
      );
    });

    it('button label uses serverNickname when present (priority over displayName)', () => {
      const cachedUserMap = {
        u1: {
          userName: 'testuser',
          displayName: 'TestDisplay',
          avatar: null,
          guilds: { 'guild-1': { roles: [], nick: 'NicknameOnGuild', joinedAt: '2026-01-01' } },
          timestamp: 0,
        },
      };
      renderWithProviders(
        <UserProfileModal
          {...defaultProps}
          cachedUserMap={cachedUserMap as any}
          guildId="guild-1"
          onFilterByAuthor={vi.fn()}
        />,
      );
      expect(
        screen.getByRole('button', { name: /filter messages by NicknameOnGuild/i }),
      ).toBeInTheDocument();
    });
  });
});
