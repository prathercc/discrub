/**
 * MSW-backed regression guards on Discord API response shapes
 * (Backlog #174 sub-item 4).
 *
 * Every test in this file:
 *   1. Runs the real `DiscordService` (NO `vi.mock(...)`) — so the
 *      whole fetch → parse → response-shape pipeline is exercised
 *   2. Serves captured-and-redacted Discord JSON via MSW handlers
 *
 * Why a separate file instead of extending packageSlice.enrich.test.ts:
 * those tests use `vi.mock('@/services/discordService', ...)` to
 * stub at the module layer — adding MSW alongside would mean half-
 * mocking the same boundary twice. Keeping shape regression in one
 * MSW-only file reads cleaner and lets future captures land here
 * without touching slice tests.
 *
 * Adding a new shape test:
 *   1. Capture the response from a real HAR
 *   2. Redact identifying info (snowflakes → synthetic 19-digit IDs,
 *      usernames → "fixture_user_*", content → benign placeholder)
 *   3. Save under `src/test/msw/fixtures/discord/`
 *   4. Wire it up via `mockSearchMessages` / `mockChannelMessages`
 *      from `./handlers`
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from './server';
import { mockChannelMessages, mockSearchMessages } from './handlers';
import { getDiscordService } from '@/services/discordService';
import { IsPinnedType, QueryStringParam } from 'discrub-core/discord-enum';
import type { Message } from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import searchType19Reply from './fixtures/discord/messages-search-type19-reply.json';
import aroundWithReference from './fixtures/discord/messages-around-with-reference.json';

const FIXTURE_TOKEN = 'fixture-token-not-used-by-real-discord';
const FIXTURE_GUILD_ID = '1000000000000000123';
const FIXTURE_CHANNEL_ID = '1100000000000000200';
const FIXTURE_REPLY_ID = '7700000000000000111';

const emptyCriteria: SearchCriteria = {
  searchBeforeDate: null,
  searchAfterDate: null,
  searchMessageContent: null,
  selectedHasTypes: [],
  userIds: [],
  mentionIds: [],
  channelIds: [],
  isPinned: IsPinnedType.UNSET,
};

/**
 * The `/messages/search` response shape Discord *actually* returns.
 *
 * `discrub-core` declares `SearchMessageResult.messages` as `Message[]`,
 * but the live Discord API ships `Message[][]` — each outer entry is a
 * "context group" (the hit plus its surrounding messages, used to
 * render reply previews in the official client). The slice handles
 * both shapes at runtime via `Array.isArray(messages[0])`; this test
 * file asserts on the real shape, so we declare a type that matches
 * what the wire actually carries.
 *
 * Casting to this type is the honest move — it documents the
 * discrepancy between the published type and reality without bouncing
 * through `unknown`. If discrub-core's type is ever corrected, this
 * declaration becomes redundant and can collapse into the imported
 * `SearchMessageResult` directly.
 */
type SearchHitGroups = {
  messages: Message[][];
  total_results: number;
  threads?: unknown[];
  members?: unknown[];
};

/**
 * Narrow `response.data` from `SearchMessageResult | undefined` (the
 * declared type) to the real `Message[][]` shape, after asserting the
 * runtime-observable invariants (truthy, has `messages` array). Using
 * a guard rather than a blind cast makes a shape regression surface as
 * an explicit test failure rather than a silent `undefined` access.
 */
function assertSearchHitGroups(data: unknown): asserts data is SearchHitGroups {
  if (!data || typeof data !== 'object') {
    throw new Error('Expected search response to be a non-null object');
  }
  const candidate = data as { messages?: unknown };
  if (!Array.isArray(candidate.messages)) {
    throw new Error('Expected `messages` to be an array');
  }
}

/**
 * Bulk channel-messages (`/channels/{id}/messages`) ships a flat
 * `Message[]`, which lines up with discrub-core's declared shape. The
 * type alias exists for symmetry with `SearchHitGroups` and to give
 * tests a single named entry-point per endpoint family.
 */
type ChannelMessagesResponse = Message[];

function assertChannelMessagesResponse(
  data: unknown,
): asserts data is ChannelMessagesResponse {
  if (!Array.isArray(data)) {
    throw new Error('Expected /channels/{id}/messages response to be an array');
  }
}

describe('Discord API response shapes (MSW-backed, #174)', () => {
  describe('/messages/search response with a type-19 reply', () => {
    beforeEach(() => {
      server.use(...mockSearchMessages(searchType19Reply));
    });

    it('returns the response body verbatim through DiscordService', async () => {
      const svc = getDiscordService();
      const response = await svc.fetchSearchMessageData(
        FIXTURE_TOKEN,
        0,
        FIXTURE_CHANNEL_ID,
        FIXTURE_GUILD_ID,
        emptyCriteria,
      );

      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
      assertSearchHitGroups(response.data);
      expect(response.data.total_results).toBe(2);
      expect(response.data.messages).toHaveLength(2);
    });

    it('preserves the [[group]] grouping shape Discord returns for search hits', async () => {
      // Discord ships /messages/search messages as Message[][] — each
      // outer entry is a "context group" (the hit + neighbors used to
      // populate reply previews in their official client). Our
      // consumer code currently flattens this; the regression to guard
      // against is anyone "fixing" the typing to expect a flat array.
      const svc = getDiscordService();
      const response = await svc.fetchSearchMessageData(
        FIXTURE_TOKEN,
        0,
        FIXTURE_CHANNEL_ID,
        FIXTURE_GUILD_ID,
        emptyCriteria,
      );
      assertSearchHitGroups(response.data);
      // Outer is array, inner is array — confirm both layers.
      expect(Array.isArray(response.data.messages)).toBe(true);
      expect(Array.isArray(response.data.messages[0])).toBe(true);
    });

    it('serves a type-19 reply with message_reference but NO referenced_message', async () => {
      // The shape that motivated 7fead58: search returns the reply hit
      // with a populated `message_reference` (so the consumer knows
      // it's a reply and to whom) but a NULL/MISSING `referenced_message`
      // (so the actual parent body isn't available from this endpoint).
      // Bug we're guarding: a test or refactor that assumes
      // `referenced_message` is reliably populated on search results
      // will silently mark every reply "Original message was deleted".
      const svc = getDiscordService();
      const response = await svc.fetchSearchMessageData(
        FIXTURE_TOKEN,
        0,
        FIXTURE_CHANNEL_ID,
        FIXTURE_GUILD_ID,
        emptyCriteria,
      );
      assertSearchHitGroups(response.data);
      const hit = response.data.messages[0][0];
      expect(hit.id).toBe(FIXTURE_REPLY_ID);
      expect(hit.type).toBe(19);
      expect(hit.message_reference?.message_id).toBe('8800000000000000999');
      // The load-bearing assertion: search response shape leaves the
      // parent body absent. If Discord ever fixes this server-side,
      // re-capturing the fixture will make this test fail loudly.
      expect(hit.referenced_message).toBeUndefined();
    });
  });

  describe('/channels/{id}/messages?around={id} response with referenced_message', () => {
    beforeEach(() => {
      server.use(
        mockChannelMessages(({ query }) => {
          // Ignore the around param — the fixture covers a single ID.
          // Real tests with multiple IDs would branch on query.get('around').
          void query;
          return aroundWithReference;
        }),
      );
    });

    it('returns referenced_message populated on the AROUND result', async () => {
      // Counterpart to the search test above. Same reply ID, but
      // routed through the bulk channel-messages endpoint (which is
      // why our consumer falls back to AROUND for type-19 replies).
      // This test pins that the fallback is meaningful: the parent
      // body really IS in the AROUND response.
      const svc = getDiscordService();
      const response = await svc.fetchMessageData(
        FIXTURE_TOKEN,
        FIXTURE_REPLY_ID,
        FIXTURE_CHANNEL_ID,
        QueryStringParam.AROUND,
      );

      expect(response.success).toBe(true);
      assertChannelMessagesResponse(response.data);
      expect(response.data).toHaveLength(2);
      const reply = response.data.find((m) => m.id === FIXTURE_REPLY_ID);
      expect(reply).toBeTruthy();
      expect(reply?.referenced_message).toBeTruthy();
      expect(reply?.referenced_message?.id).toBe('8800000000000000999');
      expect(reply?.referenced_message?.content).toBe(
        'parent message body',
      );
    });
  });
});
