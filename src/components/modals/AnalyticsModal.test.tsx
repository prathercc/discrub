import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import AnalyticsModal from './AnalyticsModal';
import { createBaseState } from '../../test/state-factories';
import type { Message } from 'discrub-core/types/discord-types';

vi.mock('@/extension/storage', () => {
  function makeAdapter() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      getMany: vi.fn().mockResolvedValue([]),
      setMany: vi.fn().mockResolvedValue(undefined),
      entries: vi.fn().mockResolvedValue([]),
    };
  }
  return {
    storage: {
      settings: makeAdapter(),
      state: makeAdapter(),
      presets: makeAdapter(),
      cache: makeAdapter(),
      history: makeAdapter(),
      statuslog: makeAdapter(),
      package: makeAdapter(),
      media: makeAdapter(),
    },
    migrateAllStorage: vi.fn().mockResolvedValue(undefined),
  };
});

const createMessage = (content: string, type = 0): Message =>
  ({ content, type } as Message);

const userMap = {
  '111': { userName: 'Alice', displayName: 'Alice Display', nick: undefined },
  '222': { userName: 'Bob', displayName: undefined, nick: 'Bobby' },
};

describe('AnalyticsModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog with title', () => {
    const messages = [createMessage('<@111> hello')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Mention Analytics')).toBeInTheDocument();
  });

  it('should display mention count and message count', () => {
    const messages = [
      createMessage('<@111> and <@222>'),
      createMessage('<@111> again'),
    ];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText(/3 mentions across 2 messages/)).toBeInTheDocument();
  });

  it('should render sortable table with username and mention count columns', () => {
    const messages = [createMessage('<@111> hello <@222>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Mentions')).toBeInTheDocument();
  });

  it('should display resolved usernames from userMap', () => {
    const messages = [createMessage('<@111> <@222>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Alice Display')).toBeInTheDocument();
    expect(screen.getByText('Bobby')).toBeInTheDocument();
  });

  it('should sort by count descending by default', () => {
    const messages = [
      createMessage('<@222> <@222> <@222>'),
      createMessage('<@111>'),
    ];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    const rows = screen.getAllByRole('row');
    // Header row + 2 data rows
    expect(rows).toHaveLength(3);
    // First data row should be Bobby (count 3)
    expect(rows[1]).toHaveTextContent('Bobby');
    expect(rows[1]).toHaveTextContent('3');
  });

  it('should toggle sort direction when clicking column header', () => {
    const messages = [
      createMessage('<@222> <@222> <@222>'),
      createMessage('<@111>'),
    ];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );

    // Click "Mentions" to toggle to ascending
    fireEvent.click(screen.getByText('Mentions'));
    const rows = screen.getAllByRole('row');
    // After toggle to ascending, first data row should be Alice Display (count 1)
    expect(rows[1]).toHaveTextContent('Alice Display');
    expect(rows[1]).toHaveTextContent('1');
  });

  it('should sort by username when clicking Username header', () => {
    const messages = [createMessage('<@222> <@111>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );

    fireEvent.click(screen.getByText('Username'));
    const rows = screen.getAllByRole('row');
    // Alphabetical: Alice Display before Bobby
    expect(rows[1]).toHaveTextContent('Alice Display');
    expect(rows[2]).toHaveTextContent('Bobby');
  });

  it('should show empty state when no mentions found', () => {
    const messages = [createMessage('Hello world, no mentions here')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('No mentions found')).toBeInTheDocument();
  });

  it('should show Export CSV button when mentions exist', () => {
    const messages = [createMessage('<@111> hello')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('should not show Export CSV button when no mentions', () => {
    const messages = [createMessage('Hello world')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.queryByText('Export CSV')).toBeNull();
  });

  it('should call onClose when close button clicked', () => {
    const messages = [createMessage('<@111>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    fireEvent.click(screen.getByLabelText('Close analytics'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not render when open is false', () => {
    const messages = [createMessage('<@111>')];
    renderWithProviders(
      <AnalyticsModal open={false} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.queryByText('Mention Analytics')).toBeNull();
  });

  it('should handle singular mention and message correctly', () => {
    const messages = [createMessage('<@111>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText(/1 mention across 1 message/)).toBeInTheDocument();
  });

  it('should render skip replies checkbox', () => {
    const messages = [createMessage('<@111>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Skip replies')).toBeInTheDocument();
  });

  it('should exclude reply messages when skip replies is checked', () => {
    const messages = [
      createMessage('<@111> hello', 0),
      createMessage('<@111> <@222> reply mention', 19),
      createMessage('<@222> another', 0),
    ];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );

    // Before checking: 3 messages, Alice=2 mentions, Bobby=2 mentions
    expect(screen.getByText(/4 mentions across 3 messages/)).toBeInTheDocument();

    // Check skip replies
    fireEvent.click(screen.getByText('Skip replies'));

    // After checking: 2 messages (reply excluded), Alice=1, Bobby=1
    expect(screen.getByText(/2 mentions across 2 messages/)).toBeInTheDocument();
    expect(screen.getByText(/1 replies excluded/)).toBeInTheDocument();
  });

  it('should trigger CSV download on Export CSV click', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    const mockClick = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    const messages = [createMessage('<@111>')];
    renderWithProviders(
      <AnalyticsModal open={true} onClose={mockOnClose} messages={messages} userMap={userMap} />,
      { preloadedState: createBaseState() }
    );

    fireEvent.click(screen.getByText('Export CSV'));
    expect(createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });
});
