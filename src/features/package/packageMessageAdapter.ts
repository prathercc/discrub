import type { Message, User, Attachment } from 'discrub-core/types/discord-types';
import type { PackageMessage, PackageUser } from './packageTypes';

/**
 * Convert a `PackageMessage` (from the data package CSV) into a discrub-core
 * `Message` suitable for the existing EditMessageModal / editMessages thunk.
 *
 * Only the fields the modal and thunk actually read are populated; the rest
 * use type-safe defaults. Attachment URLs in the package are expired signed
 * CDN links, but that's fine for the edit path — we only need the modal's
 * `hasAttachmentsOrEmbeds` check to recognize this message as having
 * attachments so the "empty content would clear it" guard behaves correctly.
 */
export function toDiscordMessage(
  pm: PackageMessage,
  channelId: string,
  user: PackageUser,
): Message {
  const author: User = {
    id: user.id,
    username: user.username,
    discriminator: '0',
    avatar: user.avatarHash,
    global_name: user.globalName ?? undefined,
  } as User;

  // One Attachment per URL — Discord's CSV puts multi-attachment
  // messages' URLs in a single space-separated cell, which the parser
  // (#159) splits up-front. Synthetic IDs stay unique as `${id}-${i}`
  // so React keys don't collide on N-attachment rows.
  const attachments: Attachment[] = pm.attachments.map((url, i) => ({
    id: `${pm.id}-${i}`,
    filename: deriveFilename(url),
    size: 0,
    url,
    proxy_url: url,
  } as Attachment));

  return {
    id: pm.id,
    channel_id: channelId,
    author,
    content: pm.content,
    timestamp: pm.timestamp,
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments,
    embeds: [],
    pinned: false,
    type: 0,
  };
}

function deriveFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').pop() ?? url);
  } catch {
    return url;
  }
}
