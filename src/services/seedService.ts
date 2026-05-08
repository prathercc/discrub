/**
 * Direct Discord-API client for the seeding tool (#153).
 *
 * Lives outside discrub-core deliberately — seeding is a personal
 * dev-tool, not a feature shipped in the lib. Direct fetch() keeps
 * the cross-repo surface clean.
 *
 * Every helper returns `{ ok, status, data?, error? }` (mirroring
 * discrub-core's withRetry shape) so callers can inspect non-2xx
 * responses without try/catch boilerplate.
 */

const DISCORD_API = 'https://discord.com/api/v10';

export interface SeedApiResult<T = void> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface PostMessageBody {
  content: string;
  message_reference?: {
    message_id: string;
    channel_id: string;
    fail_if_not_exists?: boolean;
  };
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
}

async function call<T = void>(
  url: string,
  init: RequestInit,
): Promise<SeedApiResult<T>> {
  try {
    const res = await fetch(url, init);
    if (res.status === 204) {
      return { ok: true, status: 204 };
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data === 'object' && data && 'message' in (data as any)
          ? String((data as any).message)
          : `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'network error',
    };
  }
}

/** Post a new message to a channel. */
export function postMessage(
  token: string,
  channelId: string,
  body: PostMessageBody,
): Promise<SeedApiResult<DiscordMessage>> {
  return call<DiscordMessage>(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: token,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Add a self-reaction. Emoji must be URL-encoded — for unicode emojis
 * that's just the character itself encodeURIComponent'd; for custom
 * emojis it would be `name:id`, but we only seed unicode here.
 */
export function addSelfReaction(
  token: string,
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<SeedApiResult> {
  return call(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    {
      method: 'PUT',
      headers: { authorization: token },
    },
  );
}

/** Edit an existing message's content. */
export function editMessageContent(
  token: string,
  channelId: string,
  messageId: string,
  newContent: string,
): Promise<SeedApiResult<DiscordMessage>> {
  return call<DiscordMessage>(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: token,
      },
      body: JSON.stringify({ content: newContent }),
    },
  );
}

/** Pin a message. Discord caps pins at 50 per channel; 403 is normal. */
export function pinMessage(
  token: string,
  channelId: string,
  messageId: string,
): Promise<SeedApiResult> {
  return call(
    `${DISCORD_API}/channels/${channelId}/pins/${messageId}`,
    {
      method: 'PUT',
      headers: { authorization: token },
    },
  );
}
