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
  /**
   * Forwarded to the lib iterator. Default `true` matches the
   * mutating-consumer semantics (purge): two consecutive dedup-empty
   * pages terminate. **Pass `false` for read-only consumers** (bulk
   * export) so dedup-empty pages don't wrongly stop the walk before
   * `total_results` is exhausted — see #169 for the data-loss bug
   * this prevents.
   */
  terminateOnDedupEmpty?: boolean;
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
  const { token, channelId, guildId, criteria, getState, shouldResetAfterPage, terminateOnDedupEmpty } = options;
  const service = getDiscordService();

  const inner = service.iterateSearchResults({
    token,
    channelId,
    guildId,
    criteria,
    terminateOnDedupEmpty,
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
 * Milestone helper — returns the next boundary above `current` for
 * progress-log emission. Step size scales with `current` so small
 * operations get periodic feedback (otherwise a 25-message purge
 * would never log between "Searching..." and "Completed") while
 * large operations keep the original 100-step cadence to avoid
 * log spam.
 *
 * Step ladder: <25 → 5, <100 → 25, otherwise → 100.
 */
export const nextMilestone = (current: number): number => {
  const step = current < 25 ? 5 : current < 100 ? 25 : 100;
  return current === 0 ? step : current + step - (current % step);
};
