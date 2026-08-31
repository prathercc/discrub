import { useState, useRef, useCallback, useEffect } from 'react';
import { Drawer, Box, Tabs, Tab, keyframes, useMediaQuery, useTheme } from '@mui/material';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectSetting, selectKofiOverlayOpen, setKofiOverlayOpen } from '@features/app/appSlice';
import { storage } from '@/extension/storage';
import { useDonations } from './useDonations';
import { DonationView, SKY_SEEN_STORAGE_KEY } from './donationTypes';
import DonationFeed from './DonationFeed';
import DonationLeaderboard from './DonationLeaderboard';
import SupporterSky from './SupporterSky';
import DonationDrawerFooter from './DonationDrawerFooter';

export const DRAWER_WIDTH = 320;
const PAGE_SIZE = 25;

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

/** The Sky's nova mint, breathing on the unvisited tab. */
const NOVA = '#7ce8c4';

const skyShimmer = keyframes`
  0%, 100% { text-shadow: 0 0 6px rgba(124, 232, 196, 0.35); }
  50% { text-shadow: 0 0 12px rgba(124, 232, 196, 0.75); }
`;

const DonationDrawer = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  // Below `md` the feed overlays the app as a temporary drawer (tap
  // outside or the Supporter Wall menu item closes it) instead of
  // reserving a 320px column the phone doesn't have.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const showFeed = useAppSelector(selectSetting(DiscrubSetting.APP_SHOW_KOFI_FEED));
  const overlayOpen = useAppSelector(selectKofiOverlayOpen);
  // Desktop follows the persisted setting (a remembered column); mobile
  // follows a transient flag so the wall never covers the app on load.
  const open = isMobile ? overlayOpen : showFeed === 'true';
  const handleClose = () => dispatch(setKofiOverlayOpen(false));
  const { donations, isLoading } = useDonations(open);
  const [view, setView] = useState<DonationView>(DonationView.FEED);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Intrigue once, never nag (the gift-button pattern): the Sky tab
  // shimmers until its first visit, then stays calm forever.
  const [skySeen, setSkySeen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    storage.state
      .get<boolean>(SKY_SEEN_STORAGE_KEY)
      .then((value) => {
        if (!cancelled) setSkySeen(Boolean(value));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  }, []);

  const handleViewChange = (_: unknown, newValue: DonationView) => {
    setView(newValue);
    setVisibleCount(PAGE_SIZE);
    if (newValue === DonationView.SKY && !skySeen) {
      setSkySeen(true);
      storage.state.set(SKY_SEEN_STORAGE_KEY, true).catch(() => {});
    }
    // Reset scroll position on tab switch
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="right"
      open={open}
      onClose={isMobile ? handleClose : undefined}
      ModalProps={isMobile ? { keepMounted: false } : undefined}
      PaperProps={{ 'data-testid': 'donation-drawer' } as object}
      sx={{
        width: open && !isMobile ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isMobile ? 'min(320px, 88vw)' : DRAWER_WIDTH,
          height: '100vh',
          bgcolor: 'background.default',
          borderLeft: 1,
          borderColor: 'divider',
          boxSizing: 'border-box',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Tabs
          value={view}
          onChange={handleViewChange}
          variant="fullWidth"
          sx={{
            minHeight: 42,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 42,
              color: 'text.disabled',
              textTransform: 'none',
              fontSize: '0.8rem',
              '&.Mui-selected': { color: 'primary.main' },
            },
            '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
          }}
        >
          <Tab label="Feed" value={DonationView.FEED} />
          <Tab label="Top" value={DonationView.LEADERBOARD} />
          <Tab
            label={skySeen ? 'Sky' : 'Sky ✦'}
            value={DonationView.SKY}
            data-testid="donation-tab-sky"
            sx={
              skySeen
                ? undefined
                : {
                    color: `${NOVA} !important`,
                    animation: `${skyShimmer} 3s ease-in-out infinite`,
                    '&.Mui-selected': { color: `${NOVA} !important` },
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                      textShadow: '0 0 8px rgba(124, 232, 196, 0.5)',
                    },
                  }
            }
          />
        </Tabs>

        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          // The Sky tab fills the column instead of scrolling: the sky
          // itself stretches to take every spare pixel.
          sx={
            view === DonationView.SKY
              ? { flex: 1, overflow: 'hidden', p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0 }
              : { flex: 1, overflow: 'auto', p: 1.5 }
          }
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    height: 60,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    animation: `${glowPulse} 1.8s ease-in-out infinite`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </Box>
          ) : view === DonationView.FEED ? (
            <DonationFeed donations={donations} visibleCount={visibleCount} />
          ) : view === DonationView.SKY ? (
            <SupporterSky donations={donations} />
          ) : (
            <DonationLeaderboard donations={donations} visibleCount={visibleCount} />
          )}
        </Box>

        {!isLoading && <DonationDrawerFooter donations={donations} />}
      </Box>
    </Drawer>
  );
};

export default DonationDrawer;
