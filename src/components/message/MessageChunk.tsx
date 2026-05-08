import { memo } from 'react';
import { Avatar, Box, Typography, useTheme } from '@mui/material';
import { Forum as ThreadIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import type { Message, User } from 'discrub-core/types/discord-types';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';
import { isSystemMessageType } from 'discrub-core/system-messages';
import { getDisplayName } from '@/utils/userDisplayUtils';
import { getUserRoleColor, getUserRoleIcon } from '@/utils/roleColorUtils';
import MessageFeedRow from './MessageFeedRow';
import SystemMessageRow from './SystemMessageRow';
import type { MessageChunk as MessageChunkType } from '@/utils/messageChunking';

interface MessageChunkProps {
  chunk: MessageChunkType;
  selectedIds: Set<string>;
  /** Deep-link target ID (#123). Applied as a flash highlight on the
   *  matching row; ignored when null. */
  highlightedMessageId?: string | null;
  formattingContext: HtmlFormattingContext;
  fullUserMap: Record<string, User>;
  cachedUserMap: ExportUserMap;
  guildId: string | null;
  guildRoles: any;
  settings: any;
  onToggleSelect: (message: Message) => void;
  onAuthorClick: (user: User) => void;
  onMentionClick: (user: User) => void;
  onOpenAttachments: (message: Message) => void;
  onOpenReactions: (message: Message) => void;
  onOpenThread?: (message: Message) => void;
}

const MessageChunk = memo(function MessageChunk({
  chunk,
  selectedIds,
  highlightedMessageId,
  formattingContext,
  fullUserMap,
  cachedUserMap,
  guildId,
  guildRoles,
  settings,
  onToggleSelect,
  onAuthorClick,
  onMentionClick,
  onOpenAttachments,
  onOpenReactions,
  onOpenThread,
}: MessageChunkProps) {
  const theme = useTheme();

  const first = chunk.messages[0];

  // System-message chunks are always single-message (the chunker breaks on
  // any non-type-0 message). Render them as a compact Discord-style notice
  // row — no avatar, no chunk header. Types 0/19/20/21/23 skip this branch
  // and fall through to the normal avatar + content layout below.
  if (chunk.messages.length === 1 && isSystemMessageType(first.type)) {
    return (
      <SystemMessageRow
        message={first}
        formattingContext={formattingContext}
        guildId={guildId}
        guildRoles={guildRoles}
        cachedUserMap={cachedUserMap}
        highlighted={highlightedMessageId === first.id}
      />
    );
  }

  const author = first.author;
  const roleColor = author?.id
    ? getUserRoleColor(author.id, guildId, cachedUserMap, guildRoles)
    : null;
  const roleIcon = author?.id
    ? getUserRoleIcon(author.id, guildId, cachedUserMap, guildRoles)
    : null;

  const displayName = author
    ? settings
      ? getDisplayName(author, cachedUserMap, guildId, settings)
      : author.global_name || author.username || 'Unknown'
    : 'Unknown';

  const avatarSrc = author?.avatar
    ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`
    : undefined;

  let headerTimestamp = '';
  try {
    const timeFmt = settings?.timeFormat || 'h:mm aa';
    headerTimestamp = format(
      new Date(chunk.firstTimestamp),
      `MMM d, yyyy ${timeFmt}`,
    );
  } catch {
    headerTimestamp = chunk.firstTimestamp;
  }

  const threadMessage = chunk.messages.find(
    (m) => (m as any).thread,
  );

  return (
    <Box
      data-testid="message-chunk"
      sx={{
        display: 'flex',
        gap: 1,
        px: 1.25,
        py: 0.75,
      }}
    >
      <Avatar
        src={avatarSrc}
        onClick={() => author && onAuthorClick(author)}
        data-tour="author-avatar"
        sx={{
          width: 40,
          height: 40,
          cursor: author ? 'pointer' : 'default',
          flexShrink: 0,
          mt: 0.5,
          transition: 'opacity 120ms ease',
          '&:hover': author ? { opacity: 0.85 } : undefined,
        }}
      >
        {author?.username?.[0]?.toUpperCase()}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 0.25,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            component="span"
            fontWeight={600}
            onClick={() => author && onAuthorClick(author)}
            sx={{
              cursor: author ? 'pointer' : 'default',
              color: roleColor || 'text.primary',
              '&:hover': author ? { textDecoration: 'underline' } : undefined,
            }}
          >
            {displayName}
          </Typography>
          {roleIcon?.type === 'image' && (
            <Box
              component="img"
              src={`https://cdn.discordapp.com/role-icons/${roleIcon.roleId}/${roleIcon.hash}.webp?size=20`}
              sx={{ width: 16, height: 16, flexShrink: 0 }}
            />
          )}
          {roleIcon?.type === 'emoji' && (
            <Typography component="span" sx={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
              {roleIcon.emoji}
            </Typography>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.75rem' }}
          >
            {headerTimestamp}
          </Typography>
          {threadMessage && onOpenThread && (
            <Typography
              component="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenThread(threadMessage);
              }}
              sx={{
                border: 0,
                background: 'none',
                p: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                fontSize: '0.75rem',
                color: theme.palette.primary.main,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              <ThreadIcon sx={{ fontSize: 14 }} />
              Open thread
            </Typography>
          )}
        </Box>

        {chunk.messages.map((message, idx) => (
          <MessageFeedRow
            key={message.id}
            message={message}
            isFirstInChunk={idx === 0}
            selected={selectedIds.has(message.id)}
            highlighted={highlightedMessageId === message.id}
            formattingContext={formattingContext}
            fullUserMap={fullUserMap}
            cachedUserMap={cachedUserMap}
            guildId={guildId}
            guildRoles={guildRoles}
            settings={settings}
            onToggleSelect={onToggleSelect}
            onMentionClick={onMentionClick}
            onOpenAttachments={onOpenAttachments}
            onOpenReactions={onOpenReactions}
          />
        ))}
      </Box>
    </Box>
  );
});

export default MessageChunk;
