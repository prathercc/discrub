import type { Message } from 'discrub-core/types/discord-types';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';
import type { ExportConfig, MediaMaps, TextFormatOptions } from './exportTypes';
import { defaultTextFormatOptions } from './exportTypes';
import { getUserDisplayData } from '@/utils/userDisplayUtils';
import { formatMessageTimestamp } from '@/utils/dateUtils';
import { getMessageContent } from '@/utils/messageUtils';

const SYSTEM_MESSAGE_TYPES = new Set<number>([
  // 0 = default, 19 = reply, 21 = thread-starter render as normal user messages.
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 36, 37, 38, 39, 40,
]);

const REPLY_SNIPPET_MAX = 80;

const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
const DEFAULT_TIME_FORMAT = 'HH:mm:ss';

function formatTimestamp(value: string | null | undefined, exportConfig?: ExportConfig): string | null {
  if (!value) return null;
  const dateFormat = exportConfig?.dateFormat || DEFAULT_DATE_FORMAT;
  const timeFormat = exportConfig?.timeFormat || DEFAULT_TIME_FORMAT;
  try {
    return formatMessageTimestamp(value, dateFormat, timeFormat);
  } catch {
    return value;
  }
}

function resolveAuthorName(
  message: Message,
  cachedUserMap: ExportUserMap,
  guildId: string | null,
): string {
  if (!message.author) return 'Unknown';
  const data = getUserDisplayData(message.author.id, cachedUserMap, guildId);
  // Prefer the resolved display name (nickname > display > username); fall
  // back to the raw author.username on the message envelope itself.
  return (
    data.nickname ||
    data.displayName ||
    data.username ||
    message.author.global_name ||
    message.author.username ||
    'Unknown'
  );
}

function isBotAuthor(message: Message): boolean {
  return Boolean(message.author?.bot || message.webhook_id);
}

function isSystemMessage(message: Message): boolean {
  return SYSTEM_MESSAGE_TYPES.has(message.type);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildAuthorLine(
  message: Message,
  cachedUserMap: ExportUserMap,
  guildId: string | null,
  exportConfig: ExportConfig | undefined,
  options: TextFormatOptions,
): string {
  const author = resolveAuthorName(message, cachedUserMap, guildId);
  const botSuffix =
    options.botIndicator === 'include' && isBotAuthor(message) ? ' [BOT]' : '';
  const created = formatTimestamp(message.timestamp, exportConfig);
  const edited = formatTimestamp(message.edited_timestamp, exportConfig);
  const editedSuffix = edited ? `, edited ${edited}` : '';
  const timestampPart = created ? ` (${created}${editedSuffix})` : '';
  return `@${author}${botSuffix}${timestampPart}`;
}

function buildReplyLine(
  message: Message,
  cachedUserMap: ExportUserMap,
  guildId: string | null,
  options: TextFormatOptions,
): string | null {
  if (options.replies === 'skip') return null;
  // Replies use `message_reference` with the actual replied-to message
  // attached on `referenced_message`. Thread-starter messages (type 21)
  // also carry a reference but their content goes on the message itself,
  // so they should not render an extra quote line.
  if (!message.message_reference || message.type === 21) return null;
  const referenced = message.referenced_message;
  if (!referenced) {
    if (options.replies === 'link') {
      return '> (referenced message unavailable)';
    }
    return null;
  }
  const author = resolveAuthorName(referenced, cachedUserMap, guildId);
  if (options.replies === 'link') {
    return `> reply to @${author}`;
  }
  const snippet = singleLine(referenced.content || '');
  if (!snippet) {
    return `> @${author}: (no content)`;
  }
  return `> @${author}: ${truncate(snippet, REPLY_SNIPPET_MAX)}`;
}

function buildAttachmentLines(
  message: Message,
  mediaMaps: MediaMaps | null | undefined,
  options: TextFormatOptions,
): string[] {
  if (options.attachmentStyle === 'skip') return [];
  if (!message.attachments || message.attachments.length === 0) return [];
  return message.attachments.map((att) => {
    const filename = att.filename || 'attachment';
    if (options.attachmentStyle === 'sidecar') {
      const local = mediaMaps?.mediaMap?.[att.url];
      const target = local || att.url;
      return `[Attachment: ${filename} — ${target}]`;
    }
    return `[Attachment: ${filename} — ${att.url}]`;
  });
}

function emojiToString(name: string | null | undefined, id: string | null | undefined): string {
  if (id && name) return `:${name}:`;
  if (name) return name;
  return ':emoji:';
}

function buildReactionsLine(
  message: Message,
  options: TextFormatOptions,
): string | null {
  if (options.reactions === 'skip') return null;
  const reactions = message.reactions;
  if (!reactions || reactions.length === 0) return null;
  const parts = reactions.map((r) => {
    const label = emojiToString(r.emoji?.name, r.emoji?.id);
    const count = r.count ?? 0;
    return `${label} ×${count}`;
  });
  return `Reactions: ${parts.join(', ')}`;
}

function buildSystemBlock(
  message: Message,
  cachedUserMap: ExportUserMap,
  guildId: string | null,
  exportConfig: ExportConfig | undefined,
): string {
  const author = resolveAuthorName(message, cachedUserMap, guildId);
  const content = singleLine(getMessageContent(message)) || 'system event';
  const ts = formatTimestamp(message.timestamp, exportConfig);
  const tsPart = ts ? ` (${ts})` : '';
  return `-- @${author}: ${content}${tsPart} --`;
}

/**
 * Build a single message's text block. Returns an array of lines (no
 * trailing newline; the caller joins with `\n`). Empty messages with no
 * content, attachments, or reactions yield a single header line so the
 * timestamp is preserved.
 */
export function buildTextMessageBlock(
  message: Message,
  cachedUserMap: ExportUserMap,
  guildId: string | null,
  exportConfig: ExportConfig | undefined,
  mediaMaps: MediaMaps | null | undefined,
  options: TextFormatOptions,
): string[] {
  if (isSystemMessage(message)) {
    return [buildSystemBlock(message, cachedUserMap, guildId, exportConfig)];
  }

  const lines: string[] = [];
  const replyLine = buildReplyLine(message, cachedUserMap, guildId, options);
  if (replyLine) lines.push(replyLine);
  lines.push(buildAuthorLine(message, cachedUserMap, guildId, exportConfig, options));
  const body = getMessageContent(message);
  if (body) {
    for (const bodyLine of body.split('\n')) {
      lines.push(bodyLine);
    }
  }
  lines.push(...buildAttachmentLines(message, mediaMaps, options));
  const reactionsLine = buildReactionsLine(message, options);
  if (reactionsLine) lines.push(reactionsLine);
  return lines;
}

export interface GenerateTextPageOptions {
  cachedUserMap: ExportUserMap;
  guildId: string | null;
  exportConfig?: ExportConfig;
  mediaMaps?: MediaMaps | null;
  textOptions?: TextFormatOptions;
}

/**
 * Render a page of messages as plain text. Blocks are separated by a
 * blank line; the page ends with a trailing newline.
 */
export function generateTextPage(
  messages: Message[],
  opts: GenerateTextPageOptions,
): string {
  const options = opts.textOptions ?? defaultTextFormatOptions;
  const blocks: string[] = [];
  for (const message of messages) {
    const lines = buildTextMessageBlock(
      message,
      opts.cachedUserMap,
      opts.guildId,
      opts.exportConfig,
      opts.mediaMaps,
      options,
    );
    blocks.push(lines.join('\n'));
  }
  return blocks.length === 0 ? '' : `${blocks.join('\n\n')}\n`;
}
