/**
 * Default Discord API handler factories. None of these are installed
 * automatically — tests opt into specific endpoints via `server.use(...)`
 * with the helpers below, or with raw `http.get(...)` of their own.
 *
 * Keeping fixture loading + URL pattern matching in helpers (rather
 * than expecting every test to repeat the URL pattern) makes the
 * test bodies short and lets us swap URL bases or path conventions
 * in one spot if Discord ever changes them.
 */
import { http, HttpResponse, type DefaultBodyType, type HttpHandler } from 'msw';

export const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * Mock the `/guilds/{guildId}/messages/search` endpoint (also matches
 * the channel-scoped variant `/channels/{channelId}/messages/search`,
 * which Discord uses for DM searches).
 *
 * Pass either a static body or a callback that receives the URL and
 * returns the body — useful for simulating offset pagination from
 * a captured fixture.
 */
export function mockSearchMessages(
  bodyOrFn: DefaultBodyType | ((url: URL) => DefaultBodyType),
): HttpHandler[] {
  const handler = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const body = typeof bodyOrFn === 'function' ? bodyOrFn(url) : bodyOrFn;
    return HttpResponse.json(body);
  };
  return [
    http.get(`${DISCORD_API_BASE}/guilds/:guildId/messages/search`, handler),
    http.get(`${DISCORD_API_BASE}/channels/:channelId/messages/search`, handler),
  ];
}

/**
 * Mock the `/channels/{channelId}/messages` endpoint (covers both the
 * unfiltered channel walk and `?around={id}` / `?before={id}` /
 * `?after={id}` variants — Discord uses one URL for all).
 *
 * The callback receives the parsed query params so tests can branch
 * on `around` to return per-target fixtures.
 */
export function mockChannelMessages(
  bodyOrFn:
    | DefaultBodyType
    | ((args: { channelId: string; query: URLSearchParams }) => DefaultBodyType),
): HttpHandler {
  return http.get(
    `${DISCORD_API_BASE}/channels/:channelId/messages`,
    ({ params, request }) => {
      const url = new URL(request.url);
      const body =
        typeof bodyOrFn === 'function'
          ? bodyOrFn({
              channelId: String(params.channelId),
              query: url.searchParams,
            })
          : bodyOrFn;
      return HttpResponse.json(body);
    },
  );
}
