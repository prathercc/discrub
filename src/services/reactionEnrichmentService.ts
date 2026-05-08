import { MessageFetchService, DiscordServiceAdapter } from 'discrub-core/messages';
import type { Message } from 'discrub-core/types/discord-types';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

export type EnrichmentStatusCallback = (status: string) => void;
export type EnrichmentShouldStopCallback = () => boolean | Promise<boolean>;

export interface EnrichmentCallbacks {
  onStatus?: EnrichmentStatusCallback;
  shouldStop?: EnrichmentShouldStopCallback;
  /**
   * Fires once after the settings + non-empty checks pass, immediately
   * before the lib's around-fetch loop begins. Use to surface a single
   * "Fetching reactions for N messages" entry to the user — every
   * around-fetch in the lib runs through `withDelay`, so the wall-clock
   * cost scales with `messageCount` and a status entry is the only
   * affordance they get during the wait.
   */
  onWillEnrich?: (messageCount: number) => void;
}

/**
 * Pass 1 reaction enrichment.
 *
 * Discord's `/messages/search` endpoint omits the `reactions` field on
 * returned messages. This wrapper populates it by calling
 * `MessageFetchService.resolveMessageReactions`, which fetches each
 * message's surrounding `?around=` window (~100 messages with reactions
 * inline) and merges them into the input list. The lib's `trackMap`
 * deduplicates within-pass so clustered hits collapse to far fewer
 * Discord calls than messages.
 *
 * This is the "does this message have reactions at all" pass. Pass 2
 * (filling in WHO reacted with each emoji) is performed at export time
 * by `ReactionEnrichmentService` in `exportSlice.fetchReactionData`.
 */
class ReactionEnrichmentServiceWrapper {
  /**
   * Enrich the `reactions` field on each input message in-place
   * (returns a new array, original messages untouched).
   *
   * Short-circuits without constructing a service when:
   * - the input is empty
   * - `REACTIONS_ENABLED` setting is not `'true'`
   *
   * Returns the original input unchanged on failure (logged to console).
   * Partial enrichment from cancellation is preserved — messages not
   * pulled into any around-window end up with `reactions: undefined`,
   * matching the lib's documented behavior.
   */
  async enrichMessages(
    messages: Message[],
    token: string,
    settings: AppSettings | null | undefined,
    callbacks?: EnrichmentCallbacks,
  ): Promise<Message[]> {
    if (messages.length === 0) return messages;
    if (!settings || settings[DiscrubSetting.REACTIONS_ENABLED] !== 'true') return messages;

    callbacks?.onWillEnrich?.(messages.length);

    try {
      const apiClient = new DiscordServiceAdapter(settings);
      const fetchService = new MessageFetchService({
        apiClient,
        token,
        settings: {
          reactionsEnabled: true,
          displayNameLookup: false,
          serverNickNameLookup: false,
          userDataRefreshRate: 0,
        },
        onStatus: callbacks?.onStatus,
        shouldStop: callbacks?.shouldStop,
      });

      return await fetchService.resolveMessageReactions(messages);
    } catch (error) {
      console.error('Failed to enrich message reactions:', error);
      return messages;
    }
  }
}

export const reactionEnrichmentService = new ReactionEnrichmentServiceWrapper();
export { ReactionEnrichmentServiceWrapper };
