import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import PauseResumeControls from './PauseResumeControls';
import { initialExportState } from '@features/export/exportTypes';

describe('PauseResumeControls', () => {
  it('renders nothing when no operation running', () => {
    const { container } = renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState(),
    });
    expect(container.firstChild).toBeNull();
  });

  it('shows Pause button when operation running and not paused', () => {
    renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
        app: {
          discrubPaused: false,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          sidebarView: 'server' as const,
          task: { status: 'idle', message: '' },
          settings: null,
          previewThemeId: null,
        },
      }),
    });
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });

  it('shows Resume button when paused', () => {
    renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
        app: {
          discrubPaused: true,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          sidebarView: 'server' as const,
          task: { status: 'idle', message: '' },
          settings: null,
          previewThemeId: null,
        },
      }),
    });
    expect(screen.getByLabelText('Resume')).toBeInTheDocument();
  });

  it('shows Cancel button when operation running', () => {
    renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
  });

  it('dispatches setDiscrubPaused(true) when Pause clicked', () => {
    const { store } = renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    fireEvent.click(screen.getByLabelText('Pause'));
    expect(store.getState().app.discrubPaused).toBe(true);
    expect(store.getState().status.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ level: 'warning', message: 'Operation Paused' })]),
    );
  });

  it('dispatches setDiscrubPaused(false) when Resume clicked', () => {
    const { store } = renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
        app: {
          discrubPaused: true,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          sidebarView: 'server' as const,
          task: { status: 'idle', message: '' },
          settings: null,
          previewThemeId: null,
        },
      }),
    });
    fireEvent.click(screen.getByLabelText('Resume'));
    expect(store.getState().app.discrubPaused).toBe(false);
    expect(store.getState().status.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ level: 'success', message: 'Operation Resumed' })]),
    );
  });

  it('dispatches cancel and clears pause when Cancel clicked', () => {
    const { store } = renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
        app: {
          discrubPaused: true,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          sidebarView: 'server' as const,
          task: { status: 'idle', message: '' },
          settings: null,
          previewThemeId: null,
        },
      }),
    });
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(store.getState().app.discrubCancelled).toBe(true);
    expect(store.getState().app.discrubPaused).toBe(false);
    expect(store.getState().status.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ level: 'warning', message: 'Operation Cancelled' })]),
    );
  });

  it('renders label when provided', () => {
    renderWithProviders(<PauseResumeControls label="Exporting (avatars)... 45%" />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    expect(screen.getByText('Exporting (avatars)... 45%')).toBeInTheDocument();
  });

  it('renders progress bar when progress provided', () => {
    renderWithProviders(<PauseResumeControls label="Exporting..." progress={60} />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not render label or progress bar when not provided', () => {
    renderWithProviders(<PauseResumeControls />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('remounts the label element on label change so the pulse animation re-fires', () => {
    const { rerender } = renderWithProviders(<PauseResumeControls label="Exporting (avatars)... 12 of 100" />, {
      preloadedState: createBaseState({
        export: { ...initialExportState, isExporting: true },
      }),
    });
    const firstNode = screen.getByText('Exporting (avatars)... 12 of 100');
    rerender(<PauseResumeControls label="Exporting (avatars)... 13 of 100" />);
    const secondNode = screen.getByText('Exporting (avatars)... 13 of 100');
    expect(secondNode).not.toBe(firstNode);
  });
});
