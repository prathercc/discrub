import { useState, useEffect } from 'react';
import { Box, Tabs, Tab, Drawer, useMediaQuery, useTheme, TextField, InputAdornment, IconButton, Typography } from '@mui/material';
import { Search as SearchIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectSelectedGuild, setSelectedGuild } from '@features/guild/guildSlice';
import { selectSidebarView, setSidebarView } from '@features/app/appSlice';
import ServerList from './ServerList';
import DMList from './DMList';
import ChannelList from './ChannelList';
import PackageChannelList from '@/components/package/PackageChannelList';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

/**
 * Sidebar component - contains navigation for servers, DMs, and channels
 */
const Sidebar = ({ open = true, onClose }: SidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState(0);
  const [filterText, setFilterText] = useState('');
  const dispatch = useAppDispatch();
  const selectedGuild = useAppSelector(selectSelectedGuild);
  const sidebarView = useAppSelector(selectSidebarView);

  useEffect(() => {
    // Clear search text when navigating between server and channel views
    setFilterText('');
  }, [selectedGuild, tab]);

  useEffect(() => {
    // Keep Redux sidebarView in sync when user switches to/from Package tab.
    const desired = tab === 2 ? 'package' : 'server';
    if (desired !== sidebarView) dispatch(setSidebarView(desired));
  }, [tab, sidebarView, dispatch]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  const handleBackToServers = () => {
    dispatch(setSelectedGuild(null));
  };

  const renderChannelHeader = () => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'action.hover',
      }}
    >
      <IconButton
        onClick={handleBackToServers}
        size="small"
        sx={{
          mr: 1,
          color: 'text.secondary',
          transition: 'all 200ms ease',
          '&:hover': {
            color: 'primary.main',
            backgroundColor: 'rgba(114, 137, 218, 0.1)',
            transform: 'scale(1.05)',
          },
        }}
      >
        <ArrowBackIcon fontSize="small" />
      </IconButton>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          fontSize: '0.95rem',
          color: 'text.primary',
          flexGrow: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {selectedGuild?.name}
      </Typography>
    </Box>
  );

  const sidebarContent = (
    <Box
      sx={{
        width: isMobile ? 280 : 320,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{
          borderBottom: '2px solid transparent',
          borderImage: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark}) 1`,
          '& .MuiTab-root': {
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '1rem',
            transition: 'background-color 200ms ease',
            '&:hover': {
              backgroundColor: 'rgba(114, 137, 218, 0.08)',
            },
            '&.Mui-selected': {
              background: 'linear-gradient(135deg, rgba(114, 137, 218, 0.15) 0%, rgba(88, 101, 242, 0.1) 100%)',
            },
          },
          '& .MuiTabs-indicator': {
            height: 3,
            background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            borderRadius: '3px 3px 0 0',
          },
        }}
      >
        <Tab label="Servers" data-tour="servers-tab" />
        <Tab label="DMs" data-tour="dms-tab" />
        <Tab label="Package" data-tour="package-tab" />
      </Tabs>

      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <TextField
          fullWidth
          size="small"
          data-tour="sidebar-search"
          placeholder={
            tab === 0
              ? (selectedGuild ? "Search channels..." : "Search servers...")
              : tab === 1
                ? "Search DMs..."
                : "Search package..."
          }
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              backgroundColor: 'action.hover',
              transition: 'all 200ms ease',
              outline: 'none !important',
              boxShadow: 'none !important',
              '& fieldset': {
                borderColor: 'divider',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '1px',
              },
              '&:hover': {
                backgroundColor: 'action.selected',
                '& fieldset': {
                  borderColor: 'rgba(114, 137, 218, 0.5)',
                },
              },
              '&.Mui-focused': {
                backgroundColor: 'rgba(114, 137, 218, 0.05)',
                boxShadow: 'none !important',
                outline: 'none !important',
                '& fieldset': {
                  borderColor: 'rgba(114, 137, 218, 0.8)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '1px',
                },
              },
            },
            '& input': {
              outline: 'none !important',
              boxShadow: 'none !important',
            },
          }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {tab === 0 && (
          selectedGuild ? (
            <>
              {renderChannelHeader()}
              <ChannelList filterText={filterText} />
            </>
          ) : (
            <ServerList filterText={filterText} />
          )
        )}
        {tab === 1 && <DMList filterText={filterText} />}
        {tab === 2 && <PackageChannelList filterText={filterText} />}
      </Box>
    </Box>
  );

  // Mobile: Use drawer, Desktop: Static sidebar
  if (isMobile) {
    return (
      <Drawer anchor="left" open={open} onClose={onClose}>
        {sidebarContent}
      </Drawer>
    );
  }

  return sidebarContent;
};

export default Sidebar;
