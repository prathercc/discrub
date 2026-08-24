import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { within } from '@testing-library/react';
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

  it('should render Cancel button', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Test content" />,
      { preloadedState: createBaseState() }
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should call onDismiss when Cancel button clicked', () => {
    renderWithProviders(
      <AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Test content" />,
      { preloadedState: createBaseState() }
    );
    fireEvent.click(screen.getByText('Cancel'));
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

  describe('Version rail (past announcements)', () => {
    const ARCHIVE = [
      { version: '2.1.0', date: '2026-08-23', title: 'Discrub 2.1.0', markdown: '# Notes for 2.1.0\n\nArchived copy.' },
      { version: '2.0.10', date: '2026-08-16', title: 'Discrub 2.0.10', markdown: '# Notes for 2.0.10' },
    ];

    it('renders no rail and the plain title when there is no archive', () => {
      renderWithProviders(<AnnouncementModal open={true} onDismiss={mockOnDismiss} markdown="Live" />, {
        preloadedState: createBaseState(),
      });
      expect(screen.queryByTestId('announcement-archive-rail')).not.toBeInTheDocument();
      expect(screen.getByText('Announcement')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('shows the rail beside the live announcement, heading the list with the live entry', () => {
      renderWithProviders(
        <AnnouncementModal
          open={true}
          onDismiss={mockOnDismiss}
          markdown={"# Brand new\n\nLive body"}
          archive={ARCHIVE}
          onSelectVersion={vi.fn()}
        />,
        { preloadedState: createBaseState() }
      );
      const rail = screen.getByTestId('announcement-archive-rail');
      const items = rail.querySelectorAll('[role="button"]');
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('Latest');
      expect(items[1]).toHaveTextContent('Discrub 2.1.0');
      expect(items[1]).toHaveTextContent('August 23, 2026');
      expect(screen.getByText('Live body')).toBeInTheDocument();
      expect(screen.getByText('Announcement')).toBeInTheDocument();
    });

    it('folds the live announcement into its archive row when the headings match', () => {
      renderWithProviders(
        <AnnouncementModal
          open={true}
          onDismiss={mockOnDismiss}
          markdown={"# Notes for 2.1.0\n\nLive copy with a later typo fix."}
          archive={ARCHIVE}
          onSelectVersion={vi.fn()}
        />,
        { preloadedState: createBaseState() }
      );
      const rail = screen.getByTestId('announcement-archive-rail');
      const items = rail.querySelectorAll('[role="button"]');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Discrub 2.1.0');
      expect(screen.queryByText('Latest')).not.toBeInTheDocument();
      // Live text wins over the archived copy; title and byline come from the row.
      expect(screen.getByText('Live copy with a later typo fix.')).toBeInTheDocument();
      expect(screen.queryByText('Archived copy.')).not.toBeInTheDocument();
      expect(screen.getByText('Posted August 23, 2026')).toBeInTheDocument();
    });

    it('shows a selected archived version with its byline, and reports rail clicks', () => {
      const onSelectVersion = vi.fn();
      renderWithProviders(
        <AnnouncementModal
          open={true}
          onDismiss={mockOnDismiss}
          markdown="# Notes for 2.1.0"
          archive={ARCHIVE}
          selectedVersion="2.0.10"
          onSelectVersion={onSelectVersion}
        />,
        { preloadedState: createBaseState() }
      );
      expect(screen.getByRole('heading', { name: 'Notes for 2.0.10' })).toBeInTheDocument();
      expect(screen.getByText('Posted August 16, 2026')).toBeInTheDocument();
      const rail = within(screen.getByTestId('announcement-archive-rail'));
      fireEvent.click(rail.getByText('Discrub 2.1.0'));
      expect(onSelectVersion).toHaveBeenCalledWith(null);
      fireEvent.click(rail.getByText('Discrub 2.0.10'));
      expect(onSelectVersion).toHaveBeenCalledWith('2.0.10');
    });

    it('keeps the live announcement readable when the archive fails, with a quiet note', () => {
      renderWithProviders(
        <AnnouncementModal
          open={true}
          onDismiss={mockOnDismiss}
          markdown="Live"
          archive={null}
          archiveError="Failed to load previous announcements"
        />,
        { preloadedState: createBaseState() }
      );
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByTestId('announcement-archive-error')).toHaveTextContent('Failed to load previous announcements');
      expect(screen.queryByTestId('announcement-archive-rail')).not.toBeInTheDocument();
    });
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
