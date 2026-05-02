import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import ThreadLoadModal from './ThreadLoadModal';

// Modal now uses Redux for the discovered-threads thunk (#150). All
// non-discovery tests below should still work with a default store and
// the existing prop shape (no channel / guildId → discovery list hidden).
const render = (ui: React.ReactElement) =>
  renderWithProviders(ui, {
    preloadedState: {
      auth: { token: 'tok', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
    } as any,
  });

const mockFetchActiveGuildThreads = vi.fn();
const mockFetchPublicThreads = vi.fn();
const mockFetchPrivateThreads = vi.fn();
const mockFetchJoinedPrivateArchivedThreads = vi.fn();

vi.mock('@services/discordService', () => ({
  getDiscordService: () => ({
    fetchActiveGuildThreads: mockFetchActiveGuildThreads,
    fetchPublicThreads: mockFetchPublicThreads,
    fetchPrivateThreads: mockFetchPrivateThreads,
    fetchJoinedPrivateArchivedThreads: mockFetchJoinedPrivateArchivedThreads,
  }),
}));

describe('ThreadLoadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnLoad = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onLoad: mockOnLoad,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: every endpoint returns empty so non-discovery tests
    // (which don't pass channel/guildId) don't trigger any thunk calls
    // anyway, and discovery tests can override per-test.
    mockFetchActiveGuildThreads.mockResolvedValue({ success: true, data: { threads: [] } });
    mockFetchPublicThreads.mockResolvedValue({ success: true, data: { threads: [] } });
    mockFetchPrivateThreads.mockResolvedValue({ success: true, data: { threads: [] } });
    mockFetchJoinedPrivateArchivedThreads.mockResolvedValue({ success: true, data: { threads: [] } });
  });

  it('should render dialog with title', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByText('Load Thread')).toBeInTheDocument();
  });

  it('should render text field for thread ID', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByLabelText('Thread / Forum Post ID')).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByText(/Enter a thread or forum post ID/)).toBeInTheDocument();
  });

  it('should disable Load button when input is empty', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByText('Load')).toBeDisabled();
  });

  it('should enable Load button when input has value', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Thread / Forum Post ID'), {
      target: { value: '1234567890' },
    });
    expect(screen.getByText('Load')).not.toBeDisabled();
  });

  it('should call onLoad with thread ID on click', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Thread / Forum Post ID'), {
      target: { value: '1234567890' },
    });
    fireEvent.click(screen.getByText('Load'));
    expect(mockOnLoad).toHaveBeenCalledWith('1234567890');
  });

  it('should call onLoad on Enter key press', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    const input = screen.getByLabelText('Thread / Forum Post ID');
    fireEvent.change(input, { target: { value: '1234567890' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnLoad).toHaveBeenCalledWith('1234567890');
  });

  it('should strip non-numeric characters from input', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Thread / Forum Post ID'), {
      target: { value: 'abc123def456' },
    });
    expect(screen.getByLabelText('Thread / Forum Post ID')).toHaveValue('123456');
  });

  it('should call onClose when Cancel is clicked', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when open is false', () => {
    render(<ThreadLoadModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Load Thread')).toBeNull();
  });

  it('should clear input after successful load', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    const input = screen.getByLabelText('Thread / Forum Post ID') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567890' } });
    expect(input.value).toBe('1234567890');
    fireEvent.click(screen.getByText('Load'));
    expect(mockOnLoad).toHaveBeenCalledWith('1234567890');
    expect(input.value).toBe('');
  });

  // Backlog #150: when channel + guildId are passed, the modal auto-
  // discovers threads in that channel and renders a clickable list so
  // users don't need to know the thread ID by hand. Threads with deleted
  // type-21 starter messages were otherwise invisible in the feed.
  describe('discovered threads list (Backlog #150)', () => {
    const textChannel = { id: 'parent', name: 'general', type: 0 } as any;

    it('does not render the discovery section when channel/guildId are missing', () => {
      render(<ThreadLoadModal {...defaultProps} />);
      expect(screen.queryByText('Threads in this channel')).toBeNull();
      expect(screen.queryByTestId('discovered-threads')).toBeNull();
    });

    it('renders discovered threads when channel + guildId are passed', async () => {
      mockFetchActiveGuildThreads.mockResolvedValue({
        success: true,
        data: { threads: [{ id: '111', name: 'orphan-thread', type: 11, parent_id: 'parent' }] },
      });

      render(<ThreadLoadModal {...defaultProps} channel={textChannel} guildId="g1" />);
      expect(await screen.findByText('orphan-thread')).toBeInTheDocument();
    });

    it('clicking a discovered thread row calls onLoad with that thread id', async () => {
      mockFetchActiveGuildThreads.mockResolvedValue({
        success: true,
        data: { threads: [{ id: '222', name: 'pickme', type: 11, parent_id: 'parent' }] },
      });

      render(<ThreadLoadModal {...defaultProps} channel={textChannel} guildId="g1" />);
      const row = await screen.findByTestId('discovered-thread-222');
      fireEvent.click(row);
      expect(mockOnLoad).toHaveBeenCalledWith('222');
    });

    it('renders an "Archived" chip for archived threads', async () => {
      mockFetchPublicThreads.mockResolvedValue({
        success: true,
        data: {
          threads: [{
            id: '333',
            name: 'old-thread',
            type: 11,
            parent_id: 'parent',
            thread_metadata: { archived: true, archive_timestamp: '2026-01-01T00:00:00Z' },
          }],
        },
      });

      render(<ThreadLoadModal {...defaultProps} channel={textChannel} guildId="g1" />);
      expect(await screen.findByText('old-thread')).toBeInTheDocument();
      expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
    });

    it('shows "No threads found" empty state when discovery returns nothing', async () => {
      // beforeEach defaults all endpoints to empty.
      render(<ThreadLoadModal {...defaultProps} channel={textChannel} guildId="g1" />);
      expect(await screen.findByText(/No threads found/i)).toBeInTheDocument();
    });
  });
});
