import { memo, useCallback, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  Link,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ContentCopy as CopyIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import type { Message, User } from 'discrub-core/types/discord-types';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';
import { formatContentAsHtml } from 'discrub-core/html-formatting-utils';
import { formatMessageContentLight } from '@/utils/messageLightFormatting';
import { getMessageContent } from '@/utils/messageUtils';
import { getUserRoleColor } from '@/utils/roleColorUtils';
import { useAppDispatch } from '@/app/hooks';
import { navigateToMessage } from '@features/message/messageSlice';
import {
  InlineAttachments,
  InlineEmbeds,
  InlineReactions,
} from './inlineRenderers';

/** Collapse content bodies past this pixel height behind a "Show more" toggle. */
const COLLAPSED_MAX_HEIGHT = 220;

/**
 * Static heuristic for deciding whether a message's content should be
 * collapsed behind a "Show more" affordance. Uses raw character count and
 * newline density so the decision is stable across renders — if we measured
 * the rendered DOM instead, the post-mount size change would feed back into
 * the virtualizer and trigger an infinite re-measurement loop.
 */
const shouldCollapseContent = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  if (raw.length > 500) return true;
  const newlines = raw.match(/\n/g)?.length ?? 0;
  return newlines > 6;
};

interface MessageFeedRowProps {
  message: Message;
  /** True for the first message in a chunk — its timestamp already appears
   *  in the chunk header next to the author's name, so we skip the per-row
   *  timestamp for it. */
  isFirstInChunk: boolean;
  selected: boolean;
  /** Deep-link flash (#123). When true, the row plays a 2s yellow flash
   *  animation so a user jumping to this row via a reply-bar or pin
   *  click sees exactly which row was landed on. */
  highlighted?: boolean;
  formattingContext: HtmlFormattingContext;
  fullUserMap: Record<string, User>;
  cachedUserMap: ExportUserMap;
  guildId: string | null;
  guildRoles: any;
  settings: any;
  onToggleSelect: (message: Message) => void;
  onMentionClick: (user: User) => void;
  onOpenAttachments: (message: Message) => void;
  onOpenReactions: (message: Message) => void;
}

const MessageFeedRow = memo(function MessageFeedRow({
  message,
  isFirstInChunk,
  selected,
  highlighted = false,
  formattingContext,
  fullUserMap,
  cachedUserMap,
  guildId,
  guildRoles,
  settings,
  onToggleSelect,
  onMentionClick,
  onOpenAttachments,
  onOpenReactions,
}: MessageFeedRowProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const isDark = theme.palette.mode === 'dark';

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const rawContent = getMessageContent(message);
  const hasAnyBody =
    !!rawContent ||
    (message.attachments && message.attachments.length > 0) ||
    (message.embeds && message.embeds.length > 0);

  const contentHtml = rawContent
    ? formatContentAsHtml(rawContent, formattingContext)
    : '';

  const overflowing = useMemo(() => shouldCollapseContent(rawContent), [rawContent]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('user-mention')) {
        e.stopPropagation();
        const userId = target.getAttribute('data-user-id');
        if (userId && fullUserMap[userId]) {
          onMentionClick(fullUserMap[userId]);
        }
      }
    },
    [fullUserMap, onMentionClick],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawContent || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard permission denied — silently skip */
    }
  }, [rawContent]);

  const mentionStyles = {
    '& .user-mention': {
      background: isDark ? 'rgba(88, 101, 242, 0.3)' : 'rgba(88, 101, 242, 0.15)',
      color: isDark ? '#c9d1ff' : theme.palette.primary.main,
      padding: '0 3px',
      borderRadius: '3px',
      fontWeight: 500,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: isDark ? 'rgba(88, 101, 242, 0.5)' : 'rgba(88, 101, 242, 0.25)',
        textDecoration: 'underline',
      },
    },
    '& .channel-mention': {
      background: isDark ? 'rgba(60, 66, 112, 0.5)' : 'rgba(60, 66, 112, 0.15)',
      color: isDark ? '#b5c7ff' : theme.palette.primary.dark,
      padding: '0 3px',
      borderRadius: '3px',
      fontWeight: 500,
    },
    '& .role-mention': {
      background: isDark ? 'rgba(88, 101, 242, 0.3)' : 'rgba(88, 101, 242, 0.15)',
      color: isDark ? '#c9d1ff' : theme.palette.primary.main,
      padding: '0 3px',
      borderRadius: '3px',
      fontWeight: 500,
    },
    '& .everyone-mention': {
      background: isDark ? 'rgba(250, 166, 26, 0.3)' : 'rgba(250, 166, 26, 0.15)',
      color: isDark ? '#faa61a' : '#b47615',
      padding: '0 3px',
      borderRadius: '3px',
      fontWeight: 600,
    },
    '& .custom-emoji': {
      width: 20,
      height: 20,
      verticalAlign: 'middle',
      margin: '0 2px',
    },
    '& a': {
      color: isDark ? '#00b0f4' : '#0969da',
      textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' },
    },
    '& pre': {
      background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.04)',
      padding: 1,
      borderRadius: 1,
      overflow: 'auto',
      fontFamily: 'monospace',
      fontSize: '0.85em',
      m: 0,
      my: 0.5,
    },
    '& code': {
      background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.06)',
      padding: '1px 4px',
      borderRadius: '3px',
      fontSize: '0.85em',
      fontFamily: 'monospace',
    },
    '& blockquote': {
      borderLeft: '3px solid',
      borderColor: 'divider',
      pl: 1.25,
      color: 'text.secondary',
      m: 0,
      my: 0.5,
    },
  } as const;

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't steal clicks from interactive children. `closest()` uses CSS
      // selectors, so [role="button"] (attachment thumbnails, reaction chips,
      // any Box with role=button) has to be listed explicitly — it's not
      // covered by `button`, which only matches the <button> tag.
      if (
        target.closest(
          'a, button, input, img, video, audio, [role="button"], [role="link"]',
        )
      )
        return;
      if (target.classList.contains('user-mention')) return;
      onToggleSelect(message);
    },
    [message, onToggleSelect],
  );

  let shortTimestamp = '';
  try {
    shortTimestamp = format(
      new Date(message.timestamp),
      settings?.timeFormat || 'h:mm aa',
    );
  } catch {
    /* ignore bad timestamps */
  }

  return (
    <Box
      data-testid="message-feed-row"
      data-message-id={message.id}
      data-highlighted={highlighted ? 'true' : undefined}
      onClick={handleRowClick}
      sx={{
        position: 'relative',
        display: 'block',
        py: 0.25,
        pr: 6,
        borderRadius: 0.5,
        cursor: 'pointer',
        transition: 'background-color 100ms ease',
        ...(selected
          ? {
              backgroundColor: 'rgba(114, 137, 218, 0.16)',
              borderLeft: '3px solid',
              borderLeftColor: 'primary.main',
            }
          : {
              borderLeft: '3px solid transparent',
            }),
        ...(highlighted && {
          animation: 'deeplink-flash 2s ease-out',
          '@keyframes deeplink-flash': {
            '0%': { backgroundColor: 'rgba(250, 166, 26, 0.45)' },
            '100%': {
              backgroundColor: selected
                ? 'rgba(114, 137, 218, 0.16)'
                : 'transparent',
            },
          },
        }),
        '&:hover': {
          backgroundColor: selected
            ? 'rgba(114, 137, 218, 0.2)'
            : 'rgba(114, 137, 218, 0.06)',
          '& .feed-row-hover-actions': {
            opacity: 1,
          },
          '& .feed-row-gutter-time': {
            opacity: 1,
          },
        },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {/* Reply quote (type 19) */}
        {message.type === 19 && message.referenced_message && (
          <Box
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              const targetId = message.referenced_message?.id;
              if (targetId) dispatch(navigateToMessage({ messageId: targetId }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                const targetId = message.referenced_message?.id;
                if (targetId) dispatch(navigateToMessage({ messageId: targetId }));
              }
            }}
            aria-label="Jump to replied-to message"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 0.5,
              pl: 1,
              borderLeft: '2px solid',
              borderColor: 'text.disabled',
              opacity: 0.75,
              cursor: 'pointer',
              borderRadius: 0.5,
              '&:hover': { opacity: 1, backgroundColor: 'rgba(114, 137, 218, 0.08)' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
            }}
          >
            <ReplyIcon sx={{ fontSize: 12, transform: 'scaleX(-1)' }} />
            <Typography
              variant="caption"
              fontWeight={600}
              noWrap
              sx={{
                color: message.referenced_message.author?.id
                  ? getUserRoleColor(
                      message.referenced_message.author.id,
                      guildId,
                      cachedUserMap,
                      guildRoles,
                    ) || undefined
                  : undefined,
              }}
            >
              {message.referenced_message.author?.global_name ||
                message.referenced_message.author?.username ||
                'Unknown'}
            </Typography>
            <Typography
              variant="caption"
              color="text.disabled"
              noWrap
              sx={{
                flex: 1,
                minWidth: 0,
                '& .custom-emoji': { height: 14, verticalAlign: 'middle' },
              }}
              dangerouslySetInnerHTML={{
                __html: formatMessageContentLight(
                  getMessageContent(message.referenced_message) || '(attachment)',
                  formattingContext,
                  120,
                ),
              }}
            />
          </Box>
        )}
        {message.type === 19 &&
          message.message_reference &&
          !message.referenced_message && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 0.5,
                pl: 1,
                borderLeft: '2px solid',
                borderColor: 'text.disabled',
                opacity: 0.5,
              }}
            >
              <ReplyIcon sx={{ fontSize: 12, transform: 'scaleX(-1)' }} />
              <Typography variant="caption" color="text.disabled" fontStyle="italic">
                Original message was deleted
              </Typography>
            </Box>
          )}

        {/* Content body */}
        {contentHtml ? (
          <Box sx={{ position: 'relative' }}>
            <Box
              onClick={handleContentClick}
              sx={{
                fontSize: '0.9rem',
                lineHeight: 1.5,
                color: 'text.primary',
                wordBreak: 'break-word',
                maxHeight: expanded ? 'none' : `${COLLAPSED_MAX_HEIGHT}px`,
                overflow: expanded ? 'visible' : 'hidden',
                ...mentionStyles,
              }}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
            {!expanded && overflowing && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 40,
                  pointerEvents: 'none',
                  background: isDark
                    ? 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(30,30,40,0.95))'
                    : 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.95))',
                }}
              />
            )}
            {overflowing && (
              <Link
                component="button"
                onClick={() => setExpanded((e) => !e)}
                sx={{
                  display: 'inline-block',
                  mt: 0.25,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                {expanded ? 'Show less' : 'Show more'}
              </Link>
            )}
          </Box>
        ) : !hasAnyBody ? (
          <Typography
            variant="body2"
            color="text.disabled"
            fontStyle="italic"
            sx={{ fontSize: '0.85rem' }}
          >
            (no content)
          </Typography>
        ) : null}

        {/* Inline attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <InlineAttachments
            attachments={message.attachments}
            onOpenGallery={() => onOpenAttachments(message)}
          />
        )}

        {/* Inline embeds */}
        {message.embeds && message.embeds.length > 0 && (
          <InlineEmbeds embeds={message.embeds} formattingContext={formattingContext} />
        )}

        {/* Inline reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <InlineReactions
            reactions={message.reactions}
            onReactionClick={() => onOpenReactions(message)}
          />
        )}
      </Box>

      {/* Hover-only per-message timestamp in the left gutter (Discord
          style). First message in a chunk shows the full date+time in the
          chunk header next to the author; subsequent messages reveal just
          the clock time on hover in the avatar column.
          `whiteSpace: nowrap` keeps "h:mm a" on a single line — the 40px
          avatar column isn't wide enough for "10:57 PM" at this font size,
          so we let it overflow slightly leftward into the chunk padding
          rather than wrap. */}
      {!isFirstInChunk && shortTimestamp && (
        <Typography
          className="feed-row-gutter-time"
          sx={{
            position: 'absolute',
            left: '-56px',
            top: 5,
            width: 48,
            textAlign: 'right',
            fontSize: '0.65rem',
            color: 'text.disabled',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0,
            transition: 'opacity 120ms ease',
          }}
        >
          {shortTimestamp}
        </Typography>
      )}

      {/* Floating action bar at top-right. Visible when the row is selected
          (so the tick is always legible) and on hover (to let users quick-
          select without clicking the row body). Covers the timestamp while
          visible — the bar's content is more valuable. */}
      <Box
        className="feed-row-hover-actions"
        sx={{
          position: 'absolute',
          top: 2,
          right: 8,
          opacity: selected ? 1 : 0,
          transition: 'opacity 120ms ease',
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 1,
          px: 0.5,
          py: 0.25,
        }}
      >
        <Checkbox
          size="small"
          checked={selected}
          onChange={() => onToggleSelect(message)}
          onClick={(e) => e.stopPropagation()}
          inputProps={{
            'aria-label': `Select message ${message.id}`,
          }}
          sx={{ p: 0.25 }}
        />
        <Tooltip
          title={copied ? 'Copied!' : 'Copy text'}
          placement="top"
          arrow
        >
          <span>
            <IconButton
              size="small"
              disabled={!rawContent}
              onClick={handleCopy}
              aria-label="Copy message text"
              sx={{ p: 0.5 }}
            >
              <CopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
});

export default MessageFeedRow;
