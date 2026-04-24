import { useState, useRef, useCallback } from 'react';
import { Drawer, Box, Tabs, Tab, keyframes } from '@mui/material';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector } from '@/app/hooks';
import { selectSetting } from '@features/app/appSlice';
import { useDonations } from './useDonations';
import { DonationView } from './donationTypes';
import DonationFeed from './DonationFeed';
import DonationLeaderboard from './DonationLeaderboard';
import DonationDrawerFooter from './DonationDrawerFooter';

export const DRAWER_WIDTH = 320;
const PAGE_SIZE = 25;

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

const DonationDrawer = () => {
  const showFeed = useAppSelector(selectSetting(DiscrubSetting.APP_SHOW_KOFI_FEED));
  const open = showFeed === 'true';
  const { donations, isLoading } = useDonations(open);
  const [view, setView] = useState<DonationView>(DonationView.FEED);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    // Reset scroll position on tab switch
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
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
        </Tabs>

        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{ flex: 1, overflow: 'auto', p: 1.5 }}
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
