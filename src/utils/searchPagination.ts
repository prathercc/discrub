import type { RootState } from '@/app/store';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import type { SearchIterationPage } from 'discrub-core/types/discrub-types';
import { getDiscordService } from '@/services/discordService';
import { selectSearchDelay, selectDelayModifier } from '@features/app/appSlice';
import { calculateRandomDelay } from './delayUtils';
import { cancellableDelay, checkCancelled, waitWhilePaused } from './operationLoopUtils';

export type ReduxSearchIteratorOptions = {
  token: string;
  channelId: string | null;
  guildId: string | null;
  criteria: SearchCriteria;
  getState: () => RootState;
  /**
   * Optional caller-signaled explicit reset hook (legacy safety hatch).
   * The lib iterator now self-detects index reshuffles via `total_results`
   * change, so most callers no longer need this. Returning `'reset'`
   * forces a restart at offset=0 of the current query (retaining dedupe
   * state).
   */
  shouldResetAfterPage?: () => boolean;
};

/**
 * Redux-aware wrapper around `DiscordService.iterateSearchResults`.
 *
 * Supplies pause/cancel/delay from the store so bulk callers (export,
 * purge, thread search, etc.) can share a single pagination policy
 * without re-implementing the loop. Yields pages one at a time; callers
 * log progress, dispatch updates, and perform per-page work (e.g. delete
 * messages) in between.
 */
export async function* iterateSearchMessagesRedux(
  options: ReduxSearchIteratorOptions,
): AsyncGenerator<SearchIterationPage, void, void> {
  const { token, channelId, guildId, criteria, getState, shouldResetAfterPage } = options;
  const service = getDiscordService();

  const inner = service.iterateSearchResults({
    token,
    channelId,
    guildId,
    criteria,
    shouldStop: () => checkCancelled(getState),
    onBetweenPages: async () => {
      await waitWhilePaused(getState);
      if (checkCancelled(getState)) return true;
      // Caller-signaled reset (e.g. purge just deleted matching messages).
      // Returning 'reset' short-circuits the per-page delay — the next
      // fetch has its own rate-limit protection.
      if (shouldResetAfterPage?.()) return 'reset';
      const searchDelay = selectSearchDelay(getState());
      const delayModifier = selectDelayModifier(getState());
      const delayCalc = calculateRandomDelay(searchDelay, delayModifier);
      const wasCancelled = await cancellableDelay(delayCalc.delayMs, getState);
      return wasCancelled === true;
    },
  });

  for await (const page of inner) {
    await waitWhilePaused(getState);
    if (checkCancelled(getState)) return;
    yield page;
  }
}

/**
 * Milestone helper — returns the next multiple-of-100 boundary above
 * `current`. Matches the cadence used by `loadAllSearchResults` so the
 * new bulk consumers feel consistent with single-channel search.
 */
export const nextMilestone = (current: number): number =>
  current === 0 ? 100 : current + 100 - (current % 100);
