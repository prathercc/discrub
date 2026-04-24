import { Tabs, Tab, Box, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectActiveTab,
  selectThreadTabs,
  setActiveTab,
  removeThreadTab,
} from '@features/message/messageSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';

interface ThreadTabBarProps {
  channelName: string;
}

const ThreadTabBar = ({ channelName }: ThreadTabBarProps) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const activeTab = useAppSelector(selectActiveTab);
  const threadTabs = useAppSelector(selectThreadTabs);
  const isOperationRunning = useAppSelector(selectIsHeavyOperationRunning);
  const isDark = theme.palette.mode === 'dark';

  const threadTabEntries = Object.values(threadTabs);

  const handleTabChange = (_: React.SyntheticEvent, newValue: string | false) => {
    if (newValue === false) return;
    dispatch(setActiveTab(newValue === 'main' ? null : newValue));
  };

  const handleCloseTab = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (isOperationRunning) return;
    dispatch(removeThreadTab(threadId));
  };

  const tabSx = (isActive: boolean) => ({
    minHeight: 34,
    py: 0.5,
    px: 2,
    textTransform: 'none' as const,
    borderRadius: '8px 8px 0 0',
    fontSize: '0.82rem',
    fontWeight: isActive ? 600 : 400,
    color: isActive
      ? (isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.87)')
      : (isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)'),
    backgroundColor: isActive
      ? (isDark ? 'rgba(114, 137, 218, 0.15)' : 'rgba(88, 101, 242, 0.1)')
      : 'transparent',
    border: isActive
      ? `1px solid ${isDark ? 'rgba(114, 137, 218, 0.3)' : 'rgba(88, 101, 242, 0.25)'}`
      : '1px solid transparent',
    borderBottom: isActive ? '1px solid transparent' : '1px solid transparent',
    mr: 0.25,
    transition: 'all 150ms ease',
    '&:hover': {
      backgroundColor: isActive
        ? (isDark ? 'rgba(114, 137, 218, 0.2)' : 'rgba(88, 101, 242, 0.15)')
        : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
      color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)',
    },
  });

  return (
    <Box
      data-testid="thread-tab-bar"
      sx={{
        borderBottom: `1px solid ${isDark ? 'rgba(114, 137, 218, 0.2)' : 'rgba(88, 101, 242, 0.15)'}`,
        mb: 1,
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.03)',
        px: 0.5,
        pt: 0.5,
      }}
    >
      <Tabs
        value={activeTab ?? 'main'}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        TabIndicatorProps={{ sx: { display: 'none' } }}
        sx={{
          minHeight: 34,
          '& .MuiTab-root': tabSx(false),
          '& .MuiTab-root.Mui-selected': tabSx(true),
        }}
      >
        <Tab label={channelName} value="main" />
        {threadTabEntries.map((tab) => (
          <Tab
            key={tab.threadId}
            value={tab.threadId}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.threadName}
                </span>
                <IconButton
                  size="small"
                  onClick={(e) => handleCloseTab(e, tab.threadId)}
                  disabled={isOperationRunning}
                  sx={{
                    p: 0.25,
                    ml: 0.5,
                    color: 'inherit',
                    opacity: 0.5,
                    '&:hover': { opacity: 1, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default ThreadTabBar;
