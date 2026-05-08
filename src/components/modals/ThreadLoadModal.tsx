import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { Channel } from 'discrub-core/types/discord-types';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  fetchChannelThreads,
  selectDiscoveredThreadsForChannel,
} from '@features/channel/channelSlice';
import { selectAuthToken } from '@features/auth/authSlice';

interface ThreadLoadModalProps {
  open: boolean;
  onClose: () => void;
  onLoad: (threadId: string) => void;
  /**
   * The currently-selected channel — used to discover its threads
   * automatically when the modal opens. When null (no channel context,
   * e.g. modal opened from a global affordance) the discovery list is
   * hidden and the manual ID field is the only path. Backlog #150.
   */
  channel?: Channel | null;
  /** Guild that owns the channel — needed for the active-threads endpoint. */
  guildId?: string | null;
}

const ThreadLoadModal = ({
  open,
  onClose,
  onLoad,
  channel,
  guildId,
}: ThreadLoadModalProps) => {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const cached = useAppSelector(selectDiscoveredThreadsForChannel(channel?.id));
  const [threadId, setThreadId] = useState('');
  const [discovered, setDiscovered] = useState<Channel[]>(cached ?? []);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  // Discovery loader (#165). Cache hits in the slice short-circuit
  // the network calls and resolve instantly with the existing list.
  // The Refresh button passes force=true to re-run the fetch.
  const runDiscovery = useCallback(
    (force: boolean) => {
      if (!channel || !guildId || !token) return;
      let cancelled = false;
      setDiscovering(true);
      setDiscoverError(null);

      dispatch(fetchChannelThreads({ channel, guildId, token, force }))
        .unwrap()
        .then((threads) => {
          if (!cancelled) setDiscovered(threads);
        })
        .catch((err) => {
          if (!cancelled) {
            setDiscoverError(err instanceof Error ? err.message : String(err));
          }
        })
        .finally(() => {
          if (!cancelled) setDiscovering(false);
        });

      return () => {
        cancelled = true;
      };
    },
    [channel, guildId, token, dispatch],
  );

  // Auto-discover on modal open. Cache-hit path is essentially free
  // (one selector read + a no-op thunk that returns the cached list);
  // cold path makes up to 3 parallel API calls. Either way the user
  // sees the list as soon as it's available, plus a Refresh icon for
  // when they think the cache is stale.
  useEffect(() => {
    if (!open) return;
    return runDiscovery(false);
  }, [open, runDiscovery]);

  const handleLoad = () => {
    const trimmed = threadId.trim();
    if (trimmed) {
      onLoad(trimmed);
      setThreadId('');
    }
  };

  const handlePickThread = (thread: Channel) => {
    onLoad(thread.id);
    setThreadId('');
  };

  const handleClose = () => {
    setThreadId('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && threadId.trim()) {
      handleLoad();
    }
  };

  const showDiscoveryList = !!channel && !!guildId;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Load Thread
        <DialogCloseIcon onClose={handleClose} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {showDiscoveryList && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="subtitle2">
                  Threads in this channel
                </Typography>
                <Tooltip title="Refresh thread list" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => runDiscovery(true)}
                      disabled={discovering}
                      aria-label="Refresh thread list"
                      data-testid="refresh-threads"
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              {discovering && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Looking for threads...
                  </Typography>
                </Box>
              )}
              {!discovering && discoverError && (
                <Typography variant="body2" color="error.main">
                  Couldn't load threads: {discoverError}
                </Typography>
              )}
              {!discovering && !discoverError && discovered.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No threads found in this channel.
                </Typography>
              )}
              {!discovering && discovered.length > 0 && (
                <List
                  dense
                  data-testid="discovered-threads"
                  sx={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  {discovered.map((thread) => {
                    const archived = !!(thread as any).thread_metadata?.archived;
                    return (
                      <ListItemButton
                        key={thread.id}
                        onClick={() => handlePickThread(thread)}
                        data-testid={`discovered-thread-${thread.id}`}
                      >
                        <ListItemText
                          primary={thread.name || `Thread ${thread.id}`}
                          secondary={`ID ${thread.id}`}
                          primaryTypographyProps={{ fontSize: '0.875rem', noWrap: true }}
                          secondaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }}
                        />
                        {archived && (
                          <Chip
                            label="Archived"
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1, fontSize: '0.65rem', height: 20 }}
                          />
                        )}
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>
          )}

          {showDiscoveryList && <Divider>or</Divider>}

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter a thread or forum post ID to load its messages.
            </Typography>
            <TextField
              autoFocus
              label="Thread / Forum Post ID"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              size="small"
              fullWidth
              placeholder="e.g. 1234567890"
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleLoad}
          variant="contained"
          disabled={!threadId.trim()}
        >
          Load
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThreadLoadModal;
