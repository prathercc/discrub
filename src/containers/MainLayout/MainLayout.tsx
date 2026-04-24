import { useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FullscreenExit as FullscreenExitIcon } from '@mui/icons-material';
import { Joyride } from 'react-joyride';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSetting,
  selectSettings,
  selectSidebarView,
  selectFocusedView,
  setFocusedView,
  toggleFocusedView,
} from '@features/app/appSlice';
import { fetchAnnouncement, dismissAnnouncement, selectHasNewAnnouncement, selectAnnouncementMarkdown, selectIsLoadingMarkdown, selectMarkdownError } from '@features/announcement/announcementSlice';
import { selectIsExporting, selectExportError, resetExport } from '@features/export/exportSlice';
import { selectIsPurging, selectPurgeError } from '@features/purge/purgeSlice';
import { showToast } from '@features/status/statusSlice';
import { setDiscrubCancelled, setDiscrubPaused } from '@features/app/appSlice';
import { selectIsOperationRunning } from '@features/app/operationSelectors';
import TopBar from './TopBar';
import Sidebar from '@components/navigation/Sidebar';
import ServerView from '@containers/ServerView/ServerView';
import PackageView from '@components/package/PackageView';
import DonationDrawer, { DRAWER_WIDTH } from '@components/donations/DonationDrawer';
import AnnouncementModal from '@components/modals/AnnouncementModal';
import { useBeforeUnloadWarning } from '@/hooks/useBeforeUnloadWarning';
import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';
import { useOperationStatusBroadcast } from '@/hooks/useOperationStatusBroadcast';
import { useRestoreListener } from '@/hooks/useRestoreListener';
import { useTour } from '@/hooks/useTour';
import StatusPanel from '@components/ui/StatusPanel';
import Toast from '@components/ui/Toast';
import TourTooltip from '@components/welcome/TourTooltip';
import { shellTourSteps } from '@components/welcome/tourSteps';

/**
 * MainLayout component - main application shell
 * Contains TopBar, Sidebar, content area, and DonationDrawer
 */
const MainLayout = () => {
  const dispatch = useAppDispatch();
  const showFeed = useAppSelector(selectSetting(DiscrubSetting.APP_SHOW_KOFI_FEED));
  const sidebarView = useAppSelector(selectSidebarView);
  const focusedView = useAppSelector(selectFocusedView);
  const drawerOpen = showFeed === 'true' && !focusedView;
  const hasNewAnnouncement = useAppSelector(selectHasNewAnnouncement);
  const announcementMarkdown = useAppSelector(selectAnnouncementMarkdown);
  const isLoadingMarkdown = useAppSelector(selectIsLoadingMarkdown);
  const markdownError = useAppSelector(selectMarkdownError);
  const isExporting = useAppSelector(selectIsExporting);
  const exportError = useAppSelector(selectExportError);
  const isPurging = useAppSelector(selectIsPurging);
  const purgeError = useAppSelector(selectPurgeError);
  const isOperationRunning = useAppSelector(selectIsOperationRunning);
  const prevIsExporting = useRef(false);
  const prevIsPurging = useRef(false);
  const prevIsOperationRunning = useRef(false);

  // Detect export completion (isExporting transitions from true → false)
  useEffect(() => {
    if (prevIsExporting.current && !isExporting) {
      if (exportError === 'Export cancelled') {
        dispatch(showToast({ level: 'warning', message: 'Export cancelled' }));
      } else if (exportError) {
        dispatch(showToast({ level: 'error', message: `Export failed: ${exportError}` }));
      } else {
        dispatch(showToast({ level: 'success', message: 'Export complete' }));
      }
      dispatch(resetExport());
    }
    prevIsExporting.current = isExporting;
  }, [isExporting, exportError, dispatch]);

  // Detect purge completion (isPurging transitions from true → false)
  useEffect(() => {
    if (prevIsPurging.current && !isPurging) {
      if (purgeError) {
        dispatch(showToast({ level: 'error', message: `Purge failed: ${purgeError}` }));
      } else {
        dispatch(showToast({ level: 'success', message: 'Purge complete' }));
      }
    }
    prevIsPurging.current = isPurging;
  }, [isPurging, purgeError, dispatch]);

  // Reset pause/cancel flags when any operation completes
  useEffect(() => {
    if (prevIsOperationRunning.current && !isOperationRunning) {
      dispatch(setDiscrubCancelled(false));
      dispatch(setDiscrubPaused(false));
    }
    prevIsOperationRunning.current = isOperationRunning;
  }, [isOperationRunning, dispatch]);

  // Shell tour is user-initiated (via WelcomePanel "Take a Tour"),
  // so we DON'T mark it completed on a missing target — let the user
  // retry. All shell tour steps target global chrome (Sidebar/TopBar/
  // StatusPanel) that always renders, so a miss here is exceptional.
  const shellTour = useTour('shell', { steps: shellTourSteps });

  useBeforeUnloadWarning();
  useGlobalErrorHandler();
  useOperationStatusBroadcast();
  useRestoreListener();

  // Wait for settings to load before checking the announcement gist —
  // otherwise the cached-rev comparison races against the IDB-backed
  // settings load and a previously-dismissed announcement can pop up
  // again on cold boot.
  const settings = useAppSelector(selectSettings);
  const announcementFetched = useRef(false);
  useEffect(() => {
    if (announcementFetched.current) return;
    if (!settings) return;
    announcementFetched.current = true;
    dispatch(fetchAnnouncement());
  }, [dispatch, settings]);

  const handleDismissAnnouncement = () => {
    dispatch(dismissAnnouncement());
  };

  // Focus mode keyboard shortcut: plain `F` toggles, `Escape` exits.
  // Gated on: (1) the active view is ServerView (package view has its
  // own controls we don't want to hide), (2) focus is not inside an
  // input/textarea/contentEditable (so typing "f" in the filter bar
  // never trips the toggle). Listener lives on document so it catches
  // the key regardless of where focus sits in the app chrome.
  const handleFocusKey = useCallback(
    (e: KeyboardEvent) => {
      if (sidebarView !== 'server') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        dispatch(toggleFocusedView());
      } else if (e.key === 'Escape' && focusedView) {
        e.preventDefault();
        dispatch(setFocusedView(false));
      }
    },
    [dispatch, sidebarView, focusedView],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleFocusKey);
    return () => document.removeEventListener('keydown', handleFocusKey);
  }, [handleFocusKey]);

  // Leaving server view (e.g. switching to package view) should not
  // leave focus mode "stuck on" with hidden chrome that can't be
  // exited via the feed toolbar.
  useEffect(() => {
    if (sidebarView !== 'server' && focusedView) {
      dispatch(setFocusedView(false));
    }
  }, [sidebarView, focusedView, dispatch]);

  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      <Joyride
        steps={shellTourSteps}
        run={shellTour.running}
        stepIndex={shellTour.stepIndex}
        onEvent={shellTour.handleEvent}
        continuous
        scrollToFirstStep
        tooltipComponent={TourTooltip}
        options={{
          // User escape hatch: clicking the overlay closes the tour.
          // Previously `false` (clicks ignored) — if Joyride ever got
          // stuck with an orphan overlay, users had no way out without
          // opening DevTools. Default Joyride behavior is 'close'; we
          // restore that explicitly.
          overlayClickAction: 'close',
          blockTargetInteraction: true,
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
          skipBeacon: true,
        }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          marginRight: drawerOpen ? `${DRAWER_WIDTH}px` : 0,
          transition: 'margin-right 225ms cubic-bezier(0, 0, 0.2, 1)',
        }}
      >
        {!focusedView && <TopBar />}

        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {!focusedView && <Sidebar />}

          <Box
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              backgroundColor: 'background.default',
            }}
          >
            {sidebarView === 'package' ? (
              <PackageView />
            ) : (
              <ServerView onStartShellTour={shellTour.start} />
            )}
          </Box>
        </Box>

        {!focusedView && <StatusPanel />}
      </Box>

      {!focusedView && <DonationDrawer />}

      {focusedView && (
        <Tooltip title="Exit focus mode (F or Esc)" placement="left">
          <IconButton
            aria-label="Exit focus mode"
            data-testid="exit-focus-button"
            onClick={() => dispatch(setFocusedView(false))}
            size="small"
            sx={(theme) => ({
              position: 'fixed',
              top: 12,
              right: 12,
              zIndex: theme.zIndex.drawer + 2,
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': { bgcolor: 'action.hover' },
            })}
          >
            <FullscreenExitIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <AnnouncementModal
        open={hasNewAnnouncement}
        onDismiss={handleDismissAnnouncement}
        markdown={announcementMarkdown}
        isLoading={isLoadingMarkdown}
        error={markdownError}
      />

      <Toast />
    </Box>
  );
};

export default MainLayout;
