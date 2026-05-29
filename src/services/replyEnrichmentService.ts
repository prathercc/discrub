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
   * "Fetching reply parents for N messages" entry — every around-fetch
   * in the lib runs through `withDelay`, so the wall-clock cost scales
   * with the count of eligible replies.
   */
  onWillEnrich?: (replyCount: number) => void;
}

/**
 * Reply parent enrichment for #194.
 *
 * Discord's `/messages/search` endpoint returns type-19 reply hits with
 * `message_reference` populated but `referenced_message` undefined. The
 * downstream MessageFeedRow renderer then shows "Original message was
 * deleted" for every reply, even when the parent is alive.
 *
 * This wrapper calls the lib's `MessageFetchService.resolveMessageReplies`,
 * which fetches an `?around=<parent_id>` window per unique parent and
 * splices the resolved parent back onto each reply. The lib's trackMap
 * deduplicates within-pass, so clustered replies collapse to far fewer
 * Discord calls than the raw reply count.
 *
 * Sequenced AFTER reaction enrichment at every consumer call site so
 * the two passes don't interleave around-window fetches.
 */
class ReplyEnrichmentServiceWrapper {
  /**
   * Enrich the `referenced_message` field on each input reply (returns
   * a new array; non-replies and already-enriched replies pass through
   * untouched).
   *
   * Short-circuits without constructing a service when:
   * - the input is empty
   * - no input message is an unresolved reply (saves a useless construct + adapter)
   * - `REPLIES_ENABLED` setting is not `'true'`
   *
   * Returns the original input unchanged on failure (logged to console).
   */
  async enrichMessages(
    messages: Message[],
    token: string,
    settings: AppSettings | null | undefined,
    callbacks?: EnrichmentCallbacks,
  ): Promise<Message[]> {
    if (messages.length === 0) return messages;
    if (!settings || settings[DiscrubSetting.REPLIES_ENABLED] !== 'true') return messages;

    const eligible = messages.filter(
      (m) =>
        m.type === 19 &&
        !m.referenced_message &&
        !!m.message_reference?.message_id,
    );
    if (eligible.length === 0) return messages;

    callbacks?.onWillEnrich?.(eligible.length);

    try {
      const apiClient = new DiscordServiceAdapter(settings);
      const fetchService = new MessageFetchService({
        apiClient,
        token,
        settings: {
          reactionsEnabled: false,
          displayNameLookup: false,
          serverNickNameLookup: false,
          userDataRefreshRate: 0,
        },
        onStatus: callbacks?.onStatus,
        shouldStop: callbacks?.shouldStop,
      });

      return await fetchService.resolveMessageReplies(messages);
    } catch (error) {
      console.error('Failed to enrich reply parents:', error);
      return messages;
    }
  }
}

export const replyEnrichmentService = new ReplyEnrichmentServiceWrapper();
export { ReplyEnrichmentServiceWrapper };
