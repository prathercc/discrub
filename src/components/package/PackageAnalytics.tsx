import { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Timeline as TimelineIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  loadAllPackageTimestamps,
  selectParsedPackage,
  selectTimelineError,
  selectTimelineProgress,
  selectTimelineStatus,
  selectTimelineTimestamps,
} from '@features/package/packageSlice';
import {
  computeChannelTypeBreakdown,
  computeGuildBreakdown,
  computeTimelineStats,
  computeTopChannels,
  parseDiscordTimestamp,
} from '@/utils/packageAnalyticsUtils';

const TOP_CHANNELS_LIMIT = 8;

/**
 * Analytics panel shown under the summary in PackageView.
 *
 * - Metadata-driven charts (top channels, server breakdown, channel type
 *   breakdown) render instantly from already-parsed data.
 * - Timeline stats (monthly histogram, peak hour, year totals) require
 *   loading every channel's CSV. Gated behind an opt-in button.
 */
const PackageAnalytics = () => {
  const dispatch = useAppDispatch();
  const parsed = useAppSelector(selectParsedPackage);
  const timelineStatus = useAppSelector(selectTimelineStatus);
  const timelineTimestamps = useAppSelector(selectTimelineTimestamps);
  const timelineProgress = useAppSelector(selectTimelineProgress);
  const timelineError = useAppSelector(selectTimelineError);

  const topChannels = useMemo(
    () => (parsed ? computeTopChannels(parsed.channels, TOP_CHANNELS_LIMIT) : []),
    [parsed],
  );
  const guildBreakdown = useMemo(
    () => (parsed ? computeGuildBreakdown(parsed.channels) : []),
    [parsed],
  );
  const typeBreakdown = useMemo(
    () => (parsed ? computeChannelTypeBreakdown(parsed.channels) : null),
    [parsed],
  );
  const timelineStats = useMemo(
    () =>
      timelineStatus === 'ready'
        ? computeTimelineStats(timelineTimestamps)
        : null,
    [timelineStatus, timelineTimestamps],
  );

  if (!parsed) return null;

  const maxChannelMessages = topChannels[0]?.messageCount ?? 1;
  const maxGuildMessages = guildBreakdown[0]?.messageCount ?? 1;

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      <Section title="Top channels by message count">
        <BarList
          items={topChannels.map((c) => ({
            key: c.channelId,
            label: c.label,
            sub: c.isOrphan ? 'left server' : c.guildName ?? undefined,
            value: c.messageCount,
            tone: c.isOrphan ? 'warning' : 'primary',
          }))}
          maxValue={maxChannelMessages}
        />
      </Section>

      <Section title="Messages by server">
        <BarList
          items={guildBreakdown.map((g) => ({
            key: g.guildName,
            label: g.guildName,
            sub: `${g.channelCount} channels`,
            value: g.messageCount,
            tone: g.guildName === 'Left servers' ? 'warning' : 'primary',
          }))}
          maxValue={maxGuildMessages}
        />
      </Section>

      {typeBreakdown && (
        <Section title="Channel types">
          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <TypeStat label="Guild text" value={typeBreakdown.guildText} />
            <TypeStat label="DMs" value={typeBreakdown.dms} />
            <TypeStat label="Group DMs" value={typeBreakdown.groupDms} />
            <TypeStat label="Threads" value={typeBreakdown.threads} />
            <TypeStat label="Orphans" value={typeBreakdown.orphans} tone="warning" />
          </Stack>
        </Section>
      )}

      <Section title="Activity timeline">
        {timelineStatus === 'idle' && (
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Build month-by-month and hour-of-day breakdowns. Reads every
              channel's CSV once — this may take a moment for large packages.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<TimelineIcon />}
              onClick={() => dispatch(loadAllPackageTimestamps())}
            >
              Load timeline
            </Button>
          </Stack>
        )}

        {timelineStatus === 'loading' && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {timelineProgress
                ? `Reading channel ${timelineProgress.current} of ${timelineProgress.total}`
                : 'Reading channels…'}
            </Typography>
            <LinearProgress
              variant={timelineProgress ? 'determinate' : 'indeterminate'}
              value={
                timelineProgress
                  ? (timelineProgress.current / Math.max(1, timelineProgress.total)) * 100
                  : undefined
              }
              sx={{ mt: 0.5 }}
            />
          </Box>
        )}

        {timelineStatus === 'error' && (
          <Alert severity="error">
            {timelineError ?? 'Failed to compute timeline'}
          </Alert>
        )}

        {timelineStatus === 'ready' && timelineStats && (
          <TimelineCharts stats={timelineStats} />
        )}
      </Section>
    </Stack>
  );
};

/* ────────── subcomponents ────────── */

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Paper>
);

interface BarItem {
  key: string;
  label: string;
  sub?: string;
  value: number;
  tone?: 'primary' | 'warning';
}

const BarList = ({ items, maxValue }: { items: BarItem[]; maxValue: number }) => {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No data.
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {items.map((item) => {
        const pct = Math.max(1, Math.round((item.value / maxValue) * 100));
        return (
          <Box key={item.key}>
            <Stack direction="row" spacing={1} sx={{ mb: 0.25 }}>
              <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                {item.label}
                {item.sub && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 0.75 }}
                  >
                    · {item.sub}
                  </Typography>
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.value.toLocaleString()}
              </Typography>
            </Stack>
            <Box
              sx={{
                height: 6,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor:
                    item.tone === 'warning' ? 'warning.main' : 'primary.main',
                  transition: 'width 200ms ease',
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

const TypeStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warning';
}) => (
  <Box>
    <Typography variant="h6" sx={{ color: tone === 'warning' ? 'warning.main' : 'text.primary' }}>
      {value.toLocaleString()}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

const TimelineCharts = ({ stats }: { stats: ReturnType<typeof computeTimelineStats> }) => {
  const maxMonth = stats.byMonth.reduce((max, b) => Math.max(max, b.count), 1);
  const maxHour = stats.byHour.reduce((max, b) => Math.max(max, b.count), 1);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <TypeStat
          label="messages analyzed"
          value={stats.total}
        />
        {stats.peakMonth && (
          <Box>
            <Typography variant="h6">{formatMonth(stats.peakMonth.key)}</Typography>
            <Typography variant="caption" color="text.secondary">
              peak month ({stats.peakMonth.count.toLocaleString()} msgs)
            </Typography>
          </Box>
        )}
        {stats.peakHour && (
          <Box>
            <Typography variant="h6">
              {String(stats.peakHour.hour).padStart(2, '0')}:00 UTC
            </Typography>
            <Typography variant="caption" color="text.secondary">
              most active hour
            </Typography>
          </Box>
        )}
        {stats.firstTimestamp && (
          <Box>
            <Typography variant="h6">
              {formatDate(stats.firstTimestamp)} –{' '}
              {formatDate(stats.lastTimestamp ?? stats.firstTimestamp)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              activity range
            </Typography>
          </Box>
        )}
      </Stack>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Monthly activity
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: 80,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {stats.byMonth.map((b) => (
            <Box
              key={b.key}
              title={`${b.key}: ${b.count.toLocaleString()}`}
              sx={{
                flexGrow: 1,
                minWidth: 4,
                height: `${(b.count / maxMonth) * 100}%`,
                backgroundColor: 'primary.main',
                borderRadius: '2px 2px 0 0',
                transition: 'height 200ms ease',
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Activity by hour (UTC)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 60 }}>
          {stats.byHour.map((b) => (
            <Box
              key={b.hour}
              title={`${b.hour}:00 UTC — ${b.count.toLocaleString()}`}
              sx={{
                flexGrow: 1,
                height: `${(b.count / maxHour) * 100}%`,
                backgroundColor: 'primary.dark',
                borderRadius: '2px 2px 0 0',
                minHeight: b.count > 0 ? 2 : 0,
              }}
            />
          ))}
        </Box>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.disabled">
            00:00
          </Typography>
          <Typography variant="caption" color="text.disabled">
            12:00
          </Typography>
          <Typography variant="caption" color="text.disabled">
            23:00
          </Typography>
        </Stack>
      </Box>

      {stats.byYear.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          {stats.byYear.map((y) => (
            <Box key={y.year}>
              <Typography variant="h6">{y.count.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">
                in {y.year}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

function formatMonth(key: string): string {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

function formatDate(raw: string): string {
  const d = parseDiscordTimestamp(raw);
  return d ? d.toLocaleDateString() : '—';
}

export default PackageAnalytics;
