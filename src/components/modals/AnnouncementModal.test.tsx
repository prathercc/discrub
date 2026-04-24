import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import AnnouncementModal from './AnnouncementModal';
import { createBaseState } from '../../test/state-factories';

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

describe('AnnouncementModal', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog with title and markdown content', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Hello, this is an announcement!" />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Announcement')).toBeInTheDocument();
    expect(screen.getByText('Hello, this is an announcement!')).toBeInTheDocument();
  });

  it('should render Dismiss button', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Test content" />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should call onDismiss when Dismiss button clicked', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Test content" />,
      { preloadedState: createBaseState() }
    );
    fireEvent.click(screen.getByText('Dismiss'));
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not render when open is false', () => {
    renderWithProviders(
      <AnnouncementModal open={false} onDismiss={mockOnDismiss} markdown="Test content" />,
      { preloadedState: createBaseState() }
    );
    expect(screen.queryByText('Announcement')).toBeNull();
  });

  it('should render dialog even when markdown is null (shows empty state)', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown={null} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Announcement')).toBeInTheDocument();
  });

  it('should render multiline content with preserved whitespace', () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown={multiline} />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3/)).toBeInTheDocument();
  });

  it('should show announcement icon', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Test" />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByTestId('CampaignIcon')).toBeInTheDocument();
  });

  describe('Markdown rendering', () => {
    it('should render headings as HTML heading elements', () => {
      renderWithProviders(
        <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="# Main Title" />,
        { preloadedState: createBaseState() }
      );
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Main Title');
    });

    it('should render bold text', () => {
      renderWithProviders(
        <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="This is **bold** text" />,
        { preloadedState: createBaseState() }
      );
      const strong = screen.getByText('bold');
      expect(strong.tagName).toBe('STRONG');
    });

    it('should render links as anchor elements', () => {
      renderWithProviders(
        <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Visit [Discrub](https://example.com)" />,
        { preloadedState: createBaseState() }
      );
      const link = screen.getByRole('link', { name: 'Discrub' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('should render bullet lists', () => {
      renderWithProviders(
        <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown={"- Item 1\n- Item 2\n- Item 3"} />,
        { preloadedState: createBaseState() }
      );
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('should render inline code', () => {
      renderWithProviders(
        <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Use `npm install` to install" />,
        { preloadedState: createBaseState() }
      );
      const code = screen.getByText('npm install');
      expect(code.tagName).toBe('CODE');
    });

    it('should render h2 headings from markdown', () => {
      renderWithProviders(
        <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="## Section Title" />,
        { preloadedState: createBaseState() }
      );
      // MUI DialogTitle also renders as h2, so find by text content
      expect(screen.getByText('Section Title')).toBeInTheDocument();
      expect(screen.getByText('Section Title').tagName).toBe('H2');
    });
  });
});
