import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  BarChart as AnalyticsIcon,
  Close as CloseIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import type { Message } from 'discrub-core/types/discord-types';
import { generateMentionCounts, exportMentionCountsCSV } from '@/utils/analyticsUtils';
import type { MentionCount } from '@/utils/analyticsUtils';
import { useAppDispatch } from '@/app/hooks';
import { addStatusEntry } from '@features/status/statusSlice';

const REPLY_MESSAGE_TYPE = 19;

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  userMap: Record<string, { userName?: string; displayName?: string; nick?: string }>;
}

type SortField = 'username' | 'count';
type SortDir = 'asc' | 'desc';

const AnalyticsModal = ({ open, onClose, messages, userMap }: AnalyticsModalProps) => {
  const dispatch = useAppDispatch();
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [skipReplies, setSkipReplies] = useState(false);

  const filteredMessages = useMemo(
    () => skipReplies ? messages.filter((m) => m.type !== REPLY_MESSAGE_TYPE) : messages,
    [messages, skipReplies]
  );

  const mentionCounts = useMemo(
    () => generateMentionCounts(filteredMessages, userMap),
    [filteredMessages, userMap]
  );

  const sorted = useMemo(() => {
    const copy = [...mentionCounts];
    copy.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'username') {
        return mul * a.username.localeCompare(b.username);
      }
      return mul * (a.count - b.count);
    });
    return copy;
  }, [mentionCounts, sortField, sortDir]);

  const totalMentions = useMemo(
    () => mentionCounts.reduce((sum, c) => sum + c.count, 0),
    [mentionCounts]
  );

  const maxCount = useMemo(
    () => (mentionCounts.length > 0 ? Math.max(...mentionCounts.map((m) => m.count)) : 1),
    [mentionCounts]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'count' ? 'desc' : 'asc');
    }
  };

  const handleExportCSV = () => {
    const csv = exportMentionCountsCSV(sorted);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mention-counts.csv';
    a.click();
    URL.revokeObjectURL(url);
    dispatch(addStatusEntry({ level: 'info', message: `Exported mention analytics CSV (${sorted.length} users)` }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <AnalyticsIcon sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Mention Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalMentions} mention{totalMentions !== 1 ? 's' : ''} across {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
            {skipReplies && filteredMessages.length < messages.length && (
              <> ({messages.length - filteredMessages.length} replies excluded)</>
            )}
          </Typography>
        </Box>
        <Chip
          icon={<ReplyIcon sx={{ fontSize: 14 }} />}
          label="Skip replies"
          size="small"
          variant={skipReplies ? 'filled' : 'outlined'}
          color={skipReplies ? 'primary' : 'default'}
          onClick={() => setSkipReplies(!skipReplies)}
          sx={{ cursor: 'pointer' }}
        />
        <IconButton
          onClick={onClose}
          aria-label="Close analytics"
          size="small"
          sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent sx={{ px: 3, py: 2 }}>
        {mentionCounts.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No mentions found</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, borderColor: 'rgba(114, 137, 218, 0.2)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: 'background.paper', fontWeight: 600, fontSize: '0.8rem' } }}>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'username'}
                      direction={sortField === 'username' ? sortDir : 'asc'}
                      onClick={() => handleSort('username')}
                    >
                      Username
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'count'}
                      direction={sortField === 'count' ? sortDir : 'desc'}
                      onClick={() => handleSort('count')}
                    >
                      Mentions
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((row: MentionCount, index: number) => {
                  const barWidth = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
                  return (
                    <TableRow
                      key={row.userId}
                      sx={{
                        bgcolor: index % 2 === 1 ? 'action.hover' : 'transparent',
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" noWrap>{row.username}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: 'action.hover',
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                borderRadius: 3,
                                bgcolor: 'primary.main',
                                width: `${barWidth}%`,
                                minWidth: barWidth > 0 ? 4 : 0,
                                transition: 'width 300ms ease',
                              }}
                            />
                          </Box>
                          <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'right', fontWeight: 600 }}>
                            {row.count}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      {mentionCounts.length > 0 && (
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button
            onClick={handleExportCSV}
            variant="outlined"
            startIcon={<DownloadIcon />}
            size="small"
          >
            Export CSV
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AnalyticsModal;
