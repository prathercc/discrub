import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { t } from '@/i18n';

export type OperationTier = 'heavy' | 'light' | 'idle';

export interface OperationSummary {
  isRunning: boolean;
  isPaused: boolean;
  label: string;
  progress?: number;
  /** heavy = pause/cancel/disables actions, light = spinner + status only */
  tier: OperationTier;
}

const selectExportState = (state: RootState) => state.export;
const selectMessageState = (state: RootState) => state.message;
const selectAppState = (state: RootState) => state.app;
const selectPurgeState = (state: RootState) => state.purge;
const selectChannelState = (state: RootState) => state.channel;
const selectGuildState = (state: RootState) => state.guild;
const selectDmState = (state: RootState) => state.dm;
const selectPackageState = (state: RootState) => state.package;
const selectDevState = (state: RootState) => state.dev;

export const selectOperationSummary = createSelector(
  [selectExportState, selectMessageState, selectAppState, selectPurgeState, selectChannelState, selectGuildState, selectDmState, selectPackageState, selectDevState],
  (exportState, messageState, appState, purgeState, channelState, guildState, dmState, packageState, devState): OperationSummary => {
    const isPaused = appState.discrubPaused;

    // ── HEAVY OPERATIONS (pause/cancel/disable) ──────────────────

    // Purge
    if (purgeState.isPurging) {
      const progress = purgeState.purgeProgress;

      if (progress?.bulk) {
        const { currentIndex, totalChannels, currentChannelName, completedStats, server } = progress.bulk;
        // #255: a multi-server run prefixes the server position and
        // spreads the percentage across servers, so the bar does not
        // jump back to 0 at every server boundary.
        const channelLabel = server
          ? t('operation.serverChannelLabel', {
              serverIndex: server.index + 1,
              serverTotal: server.total,
              serverName: server.name,
              channelIndex: currentIndex + 1,
              channelTotal: totalChannels,
              channelName: currentChannelName,
            })
          : t('operation.channelLabel', {
              channelIndex: currentIndex + 1,
              channelTotal: totalChannels,
              channelName: currentChannelName,
            });
        const isReactionsMode = progress.reactionsRemoved > 0 || completedStats.reactionsRemoved > 0;

        const channelFraction = totalChannels > 0 ? (currentIndex) / totalChannels : 0;
        const overallFraction = server && server.total > 0
          ? (server.index + channelFraction) / server.total
          : channelFraction;
        const pct = Math.round(overallFraction * 100);

        if (isReactionsMode) {
          const totalRemoved = completedStats.reactionsRemoved + progress.reactionsRemoved;
          return {
            isRunning: true, isPaused, tier: 'heavy',
            label: isPaused
              ? t('operation.paused', { label: channelLabel })
              : t('operation.removingReactionsBulk', { label: channelLabel, processed: progress.processed, removed: totalRemoved }),
            progress: pct,
          };
        }

        const totalDeleted = completedStats.deleted + progress.deleted;
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused
            ? t('operation.paused', { label: channelLabel })
            : t('operation.purgingBulk', { label: channelLabel, processed: progress.processed, deleted: totalDeleted }),
          progress: pct,
        };
      }

      if (progress) {
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused
            ? 'Paused · Purging'
            : `Purging... ${progress.processed} processed (${progress.deleted} deleted)`,
        };
      }
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedPurging') : t('operation.purging') };
    }

    // Export
    if (exportState.isExporting) {
      const progress = exportState.exportProgress;
      if (progress?.bulk) {
        const { currentIndex, totalChannels, currentChannelName } = progress.bulk;
        const channelLabel = `Channel ${currentIndex + 1}/${totalChannels}: ${currentChannelName}`;
        if (progress.total > 0) {
          const pct = Math.round((progress.current / progress.total) * 100);
          return {
            isRunning: true, isPaused, tier: 'heavy',
            label: isPaused ? `Paused · ${channelLabel}` : `${channelLabel} (${progress.stage})... ${pct}%`,
            progress: pct,
          };
        }
        return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? `Paused · ${channelLabel}` : channelLabel };
      }
      if (progress) {
        const pct = progress.total > 0
          ? Math.round((progress.current / progress.total) * 100)
          : 0;
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused ? t('operation.pausedExporting') : t('operation.exportingStage', { stage: progress.stage, pct }),
          progress: pct,
        };
      }
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedExporting') : t('operation.exporting') };
    }

    // Deleting messages (heavy — destructive)
    if (messageState.isDeleting) {
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedDeletingMessages') : t('operation.deletingMessages') };
    }

    // Editing messages (heavy — modifying)
    if (messageState.isEditing) {
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedEditingMessages') : t('operation.editingMessages') };
    }

    // Removing reactions (heavy — destructive, supports pause/cancel)
    if (messageState.isRemovingReactions) {
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedRemovingReactions') : t('operation.removingReactions') };
    }

    // Adding reactions (heavy — bulk PUT fan-out, supports pause/cancel; Backlog #202)
    if (messageState.isAddingReactions) {
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedAddingReactions') : t('operation.addingReactions') };
    }

    // Loading all messages (heavy — long-running, many API calls)
    const threadTabValues = Object.values(messageState.threadTabs ?? {});
    const threadLoadingAll = threadTabValues.some((tab) => tab.pagination.isLoadingAll);

    if (messageState.pagination.isLoadingAll || threadLoadingAll) {
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? t('operation.pausedLoadingAllMessages') : t('operation.loadingAllMessages') };
    }

    // Package export (heavy — bulk media download + zip build, can
    // take minutes on attachment-heavy channels, supports pause/cancel
    // via the same shouldContinue plumbing the live export uses).
    // Package thunks set `state.package.exportStatus` rather than
    // `state.export.isExporting`, so we branch on the package flag and
    // read the export-progress data the package thunk's onProgress
    // routes through `setExportProgress`.
    if (packageState.exportStatus === 'running') {
      const progress = exportState.exportProgress;
      if (progress && progress.total > 0) {
        const pct = Math.round((progress.current / progress.total) * 100);
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused
            ? t('operation.pausedPackageExportStage', { stage: progress.stage })
            : t('operation.packageExportStagePct', { stage: progress.stage, pct }),
          progress: pct,
        };
      }
      if (progress) {
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused
            ? t('operation.pausedPackageExportStage', { stage: progress.stage })
            : t('operation.packageExportStage', { stage: progress.stage }),
        };
      }
      return {
        isRunning: true, isPaused, tier: 'heavy',
        label: isPaused ? t('operation.pausedPackageExport') : t('operation.packageExport'),
      };
    }

    // Package rehydration (heavy — per-message Discord API loop, can
    // take several minutes on large channels, supports pause/cancel)
    const activeEnrichId = packageState.activeEnrichmentChannelId;
    if (activeEnrichId) {
      const progress = packageState.enrichmentProgress[activeEnrichId];
      if (progress && progress.total > 0) {
        const pct = Math.round((progress.current / progress.total) * 100);
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused
            ? `Paused · Rehydrating (${progress.current}/${progress.total})`
            : `Rehydrating... ${progress.current}/${progress.total} (${pct}%)`,
          progress: pct,
        };
      }
      return {
        isRunning: true, isPaused, tier: 'heavy',
        label: isPaused ? 'Paused · Rehydrating' : 'Rehydrating...',
      };
    }

    // Seeding (heavy — bulk POSTs across multiple channels, dev tool, #153)
    if (devState.isSeeding) {
      const progress = devState.seedProgress;
      if (progress) {
        const { channelIndex, totalChannels, currentChannelName, current, total } = progress;
        const channelLabel = totalChannels > 1
          ? `Channel ${channelIndex + 1}/${totalChannels}: #${currentChannelName}`
          : `#${currentChannelName}`;
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        return {
          isRunning: true, isPaused, tier: 'heavy',
          label: isPaused
            ? `Paused · Seeding ${channelLabel}`
            : `Seeding ${channelLabel} · ${current}/${total}`,
          progress: pct,
        };
      }
      return { isRunning: true, isPaused, tier: 'heavy', label: isPaused ? 'Paused · Seeding' : 'Seeding...' };
    }

    // ── LIGHT OPERATIONS (spinner + status log only) ─────────────

    // Message loading (initial fetch or load-more pagination)
    const threadLoading = threadTabValues.some((tab) => tab.isLoading);
    const threadLoadingMore = threadTabValues.some((tab) => tab.pagination?.isLoadingMore);
    if (messageState.isLoading || threadLoading || messageState.pagination?.isLoadingMore || threadLoadingMore) {
      return { isRunning: true, isPaused: false, tier: 'light', label: t('operation.loadingMessages') };
    }

    // Forum thread loading
    if (channelState.isLoadingForumThreads) {
      return { isRunning: true, isPaused: false, tier: 'light', label: t('operation.loadingForumPosts') };
    }

    // Guild loading
    if (guildState?.isLoading) {
      return { isRunning: true, isPaused: false, tier: 'light', label: t('operation.loadingServers') };
    }

    // Channel loading
    if (channelState?.isLoading) {
      return { isRunning: true, isPaused: false, tier: 'light', label: t('operation.loadingChannels') };
    }

    // DM loading
    if (dmState?.isLoading) {
      return { isRunning: true, isPaused: false, tier: 'light', label: t('operation.loadingDms') };
    }

    // User enrichment (display name / nickname lookups)
    if (messageState.isEnriching) {
      return { isRunning: true, isPaused: false, tier: 'light', label: t('operation.lookingUpUsers') };
    }

    // ── IDLE ─────────────────────────────────────────────────────

    return { isRunning: false, isPaused: false, tier: 'idle', label: t('operation.idle') };
  },
);

export const selectIsOperationRunning = createSelector(
  [selectOperationSummary],
  (summary) => summary.isRunning,
);

/** True only for heavy operations that should disable buttons and show pause/cancel */
export const selectIsHeavyOperationRunning = createSelector(
  [selectOperationSummary],
  (summary) => summary.tier === 'heavy',
);
