/**
 * MSW (Mock Service Worker) test server (Backlog #174 sub-item 4).
 *
 * MSW intercepts `fetch` at the global level — tests that opt in
 * make real fetch calls through `discordService` (no module mocks),
 * and MSW serves captured-and-redacted Discord API responses from
 * `fixtures/discord/*.json`.
 *
 * Why this exists: every Discord-API-shape bug we shipped this
 * cycle (snowflake precision in messages.json, type-19 reply context
 * routing, structure-sniff disambiguation) was caught by a real
 * user HAR rather than by tests. The tests themselves passed against
 * synthetic responses we'd hand-written, but real Discord ships
 * subtly different shapes. Captured fixtures close that gap.
 *
 * Scope: this is opt-in infrastructure. Existing tests that mock
 * `discordService` at the module level continue to work unchanged
 * — MSW's `onUnhandledRequest: 'bypass'` means an unmocked test
 * never sees the MSW server. New tests asserting on response shape
 * should prefer the MSW pattern; tests asserting on slice/component
 * behavior can stay on module mocks where they're more ergonomic.
 *
 * Pattern for new shape tests:
 *
 *   import { server } from '@/test/msw/server';
 *   import { http, HttpResponse } from 'msw';
 *   import searchFixture from '@/test/msw/fixtures/discord/messages-search-type19-reply.json';
 *
 *   beforeEach(() => {
 *     server.use(
 *       http.get('https://discord.com/api/v10/guilds/.\/messages/search', () =>
 *         HttpResponse.json(searchFixture),
 *       ),
 *     );
 *   });
 *
 * Lifecycle (started/stopped in `src/test/setup.ts`):
 *   - `server.listen({ onUnhandledRequest: 'bypass' })` — start once
 *   - `server.resetHandlers()` — between tests, drop per-test handlers
 *   - `server.close()` — stop after all tests
 */
import { setupServer } from 'msw/node';

export const server = setupServer();
