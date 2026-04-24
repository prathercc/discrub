import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, IconButton, Tooltip, Chip, CircularProgress, Collapse, keyframes,
} from '@mui/material';
import {
  Terminal as TerminalIcon,
  DeleteSweep as ClearIcon,
  Download as DownloadIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectStatusEntries, selectStatusCount, clearStatusLog } from '@features/status/statusSlice';
import { selectOperationSummary } from '@features/app/operationSelectors';
import type { StatusLevel } from '@features/status/statusTypes';
import PauseResumeControls from './PauseResumeControls';
import OperationTip from './OperationTip';

const PAGE_SIZE = 50;
const PANEL_HEIGHT = 150;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const levelPrefixes: Record<StatusLevel, string> = {
  info: '[INFO]',
  warning: '[WARN]',
  error: '[ERR]',
  success: '[OK]',
  session: '[SESSION]',
};

const terminalColors: Record<StatusLevel, string> = {
  info: '#8b949e',
  warning: '#d29922',
  error: '#f85149',
  success: '#3fb950',
  session: '#bc8cff',
};

/**
 * Terminal-style status log panel with fixed height.
 * Shows the latest PAGE_SIZE entries, loads more on scroll-up.
 */
const StatusPanel = () => {
  const dispatch = useAppDispatch();
  const entries = useAppSelector(selectStatusEntries);
  const count = useAppSelector(selectStatusCount);
  const operationSummary = useAppSelector(selectOperationSummary);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState(false);

  const visibleEntries = entries.slice(-visibleCount);
  const hasMore = visibleCount < count;

  // Auto-scroll to bottom when new entries arrive or panel is expanded
  useEffect(() => {
    if (!expanded || !scrollRef.current) return;
    // Delay scroll to allow Collapse animation (350ms) to complete
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, expanded ? 400 : 0);
    return () => clearTimeout(timer);
  }, [entries.length, expanded]);

  // Reset visible count when log is cleared
  useEffect(() => {
    if (count === 0) setVisibleCount(PAGE_SIZE);
  }, [count]);

  // Load more when scrolling near the top
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop < 40) {
      const prevHeight = el.scrollHeight;
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, count));
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
  }, [hasMore, count]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Box sx={{ position: 'relative' }} data-tour="status-panel">
      <OperationTip />
      <Box
        sx={{
          bgcolor: '#0d1117',
          borderTop: '1px solid #21262d',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            minHeight: 32,
            borderBottom: expanded ? '1px solid #21262d' : 'none',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' },
          }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <TerminalIcon sx={{ fontSize: 16, color: '#8b949e' }} />
          <Typography
            variant="caption"
            sx={{
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
              fontWeight: 600,
              color: '#c9d1d9',
              fontSize: '0.7rem',
              letterSpacing: '0.03em',
            }}
          >
            STATUS LOG
          </Typography>
          {operationSummary.isRunning && (
            <CircularProgress
              size={12}
              thickness={5}
              variant={operationSummary.isPaused ? 'determinate' : 'indeterminate'}
              value={operationSummary.isPaused ? 100 : undefined}
              sx={{
                color: operationSummary.isPaused ? '#d29922' : '#3fb950',
                flexShrink: 0,
              }}
              aria-label={operationSummary.isPaused ? 'Operation paused' : 'Operation in progress'}
            />
          )}
          {count > 0 && (
            <Chip
              label={count}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontFamily: 'monospace',
                bgcolor: 'rgba(139, 148, 158, 0.15)',
                color: '#8b949e',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
          {operationSummary.tier === 'light' && operationSummary.isRunning && (
            <Typography
              variant="caption"
              sx={{
                color: '#8b949e',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                fontSize: '0.65rem',
              }}
            >
              {operationSummary.label}
            </Typography>
          )}
          <PauseResumeControls
            label={operationSummary.tier === 'heavy' ? operationSummary.label : undefined}
            progress={operationSummary.tier === 'heavy' ? operationSummary.progress : undefined}
          />
          <Box sx={{ flexGrow: 1 }} />
          {count > 0 && (
            <>
              <Tooltip title="Download log" enterDelay={0} arrow>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const logContent = entries
                      .map((entry) => {
                        const time = new Date(entry.timestamp).toISOString();
                        return `[${time}] [${entry.level.toUpperCase()}] ${entry.message}`;
                      })
                      .join('\n');
                    const blob = new Blob([logContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `discrub-log-${new Date().toISOString().slice(0, 10)}.log`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{ color: '#8b949e', p: 0.25, '&:hover': { color: '#58a6ff' } }}
                  aria-label="Download log"
                >
                  <DownloadIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear log" enterDelay={0} arrow>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(clearStatusLog());
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{ color: '#8b949e', p: 0.25, '&:hover': { color: '#f85149' } }}
                  aria-label="Clear log"
                >
                  <ClearIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={expanded ? 'Collapse' : 'Expand'} enterDelay={0} arrow>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              sx={{ color: '#8b949e', p: 0.25, '&:hover': { color: '#c9d1d9' } }}
              aria-label={expanded ? 'Collapse log' : 'Expand log'}
            >
              {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Log content */}
        <Collapse in={expanded} timeout={350}>
          <Box
            ref={scrollRef}
            onScroll={handleScroll}
            sx={{
              height: PANEL_HEIGHT,
              overflow: 'auto',
              px: 1.5,
              py: 0.5,
              position: 'relative',
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(139, 148, 158, 0.2)',
                borderRadius: 3,
                '&:hover': { bgcolor: 'rgba(139, 148, 158, 0.35)' },
              },
            }}
          >
            {count === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                <Typography
                  sx={{
                    color: '#484f58',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    fontStyle: 'italic',
                  }}
                >
                  No status entries yet.
                </Typography>
              </Box>
            ) : (
              <>
                {hasMore && (
                  <Typography
                    sx={{
                      color: '#484f58',
                      fontFamily: 'monospace',
                      fontSize: '0.65rem',
                      textAlign: 'center',
                      py: 0.25,
                    }}
                  >
                    Scroll up for older entries ({count - visibleCount} more)
                  </Typography>
                )}
                {visibleEntries.map((entry, idx) => {
                  const isLast = idx === visibleEntries.length - 1;
                  const isSession = entry.level === 'session';
                  return (
                    <Box
                      key={entry.id}
                      sx={{
                        display: 'flex',
                        gap: 0.75,
                        py: '1px',
                        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                        fontSize: '0.68rem',
                        lineHeight: 1.5,
                        ...(isSession && {
                          borderTop: '1px solid #21262d',
                          borderBottom: '1px solid #21262d',
                          my: 0.25,
                          py: '3px',
                          bgcolor: 'rgba(188, 140, 255, 0.04)',
                        }),
                      }}
                    >
                      <Box
                        component="span"
                        sx={{ color: '#484f58', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {formatTime(entry.timestamp)}
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          color: terminalColors[entry.level],
                          flexShrink: 0,
                          fontWeight: 600,
                          minWidth: 65,
                        }}
                      >
                        {levelPrefixes[entry.level]}
                      </Box>
                      <Box
                        component="span"
                        sx={{ color: isSession ? '#bc8cff' : '#c9d1d9' }}
                      >
                        {entry.message}
                        {isLast && (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              width: 6,
                              height: 12,
                              bgcolor: '#58a6ff',
                              ml: 0.5,
                              verticalAlign: 'middle',
                              animation: `${blink} 1s step-end infinite`,
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}
            <div ref={bottomRef} />
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export default StatusPanel;
