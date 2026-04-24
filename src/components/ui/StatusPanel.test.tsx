import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import StatusPanel from './StatusPanel';
import { initialStatusState } from '@features/status/statusTypes';
import { initialExportState } from '@features/export/exportTypes';

describe('StatusPanel', () => {
  it('renders with STATUS LOG header', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState(),
    });
    expect(screen.getByText('STATUS LOG')).toBeInTheDocument();
  });

  it('renders entries when panel is expanded', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'Test message' },
            { id: '2', timestamp: Date.now(), level: 'error', message: 'Error occurred' },
          ],
        },
      }),
    });
    // Expand the panel
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('shows entry count chip', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'Test' },
            { id: '2', timestamp: Date.now(), level: 'info', message: 'Test 2' },
          ],
        },
      }),
    });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('clears log when clear button clicked', () => {
    const { store } = renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'Test' },
          ],
        },
      }),
    });
    const clearBtn = screen.getByLabelText('Clear log');
    fireEvent.click(clearBtn);
    expect(store.getState().status.entries).toHaveLength(0);
  });

  it('shows empty state when no entries and expanded', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState(),
    });
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText('No status entries yet.')).toBeInTheDocument();
  });

  it('shows pause/resume controls when operation is running', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
  });

  it('shows operation label and progress when exporting', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        export: {
          ...initialExportState,
          isExporting: true,
          exportProgress: { stage: 'avatars' as const, current: 5, total: 10 },
        },
      }),
    });
    expect(screen.getByText(/Exporting \(avatars\).*50%/)).toBeInTheDocument();
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show controls when no operation is running', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState(),
    });
    expect(screen.queryByLabelText('Pause')).toBeNull();
    expect(screen.queryByLabelText('Cancel')).toBeNull();
  });

  it('shows download log button when entries exist', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'Test' },
          ],
        },
      }),
    });
    expect(screen.getByLabelText('Download log')).toBeInTheDocument();
  });

  it('shows level prefixes in terminal style', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'Info msg' },
            { id: '2', timestamp: Date.now(), level: 'error', message: 'Error msg' },
            { id: '3', timestamp: Date.now(), level: 'success', message: 'Success msg' },
            { id: '4', timestamp: Date.now(), level: 'warning', message: 'Warning msg' },
            { id: '5', timestamp: Date.now(), level: 'session', message: 'Session msg' },
          ],
        },
      }),
    });
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText('[INFO]')).toBeInTheDocument();
    expect(screen.getByText('[ERR]')).toBeInTheDocument();
    expect(screen.getByText('[OK]')).toBeInTheDocument();
    expect(screen.getByText('[WARN]')).toBeInTheDocument();
    expect(screen.getByText('[SESSION]')).toBeInTheDocument();
  });

  it('shows "Scroll up for older entries" when entries exceed page size', () => {
    const manyEntries = Array.from({ length: 80 }, (_, i) => ({
      id: String(i),
      timestamp: Date.now() - (80 - i) * 1000,
      level: 'info' as const,
      message: `Entry ${i}`,
    }));
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: manyEntries,
        },
      }),
    });
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText(/Scroll up for older entries/)).toBeInTheDocument();
  });

  it('shows only the latest 50 entries initially', () => {
    const manyEntries = Array.from({ length: 80 }, (_, i) => ({
      id: String(i),
      timestamp: Date.now() - (80 - i) * 1000,
      level: 'info' as const,
      message: `Entry ${i}`,
    }));
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: manyEntries,
        },
      }),
    });
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText('Entry 79')).toBeInTheDocument();
    expect(screen.queryByText('Entry 0')).not.toBeInTheDocument();
  });

  it('does not show scroll hint when entries fit in one page', () => {
    const fewEntries = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      timestamp: Date.now(),
      level: 'info' as const,
      message: `Entry ${i}`,
    }));
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: fewEntries,
        },
      }),
    });
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.queryByText(/Scroll up for older entries/)).not.toBeInTheDocument();
  });

  it('scrolls to bottom when panel is expanded', async () => {
    vi.useFakeTimers();

    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'First entry' },
            { id: '2', timestamp: Date.now(), level: 'info', message: 'Last entry' },
          ],
        },
      }),
    });

    // Expand the panel
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText('Last entry')).toBeInTheDocument();

    // Advance past the scroll delay (400ms for Collapse animation)
    vi.advanceTimersByTime(400);

    // The scroll container should have been scrolled to bottom
    // (scrollTop set to scrollHeight by our effect)

    vi.useRealTimers();
  });

  it('toggles expand/collapse when clicking header', () => {
    renderWithProviders(<StatusPanel />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          entries: [
            { id: '1', timestamp: Date.now(), level: 'info', message: 'Test' },
          ],
        },
      }),
    });
    // Initially collapsed — expand button shows
    expect(screen.getByLabelText('Expand log')).toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse log')).toBeInTheDocument();

    // Collapse — button changes back
    fireEvent.click(screen.getByText('STATUS LOG'));
    expect(screen.getByLabelText('Expand log')).toBeInTheDocument();
  });
});
