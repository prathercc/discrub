import { memo, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { format } from 'date-fns';
import type { Message } from 'discrub-core/types/discord-types';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';
import { formatSystemMessage } from 'discrub-core/system-messages';
import { formatContentAsHtml, renderEmbedAsHtml } from 'discrub-core/html-formatting-utils';
import { getSystemMessageIcon } from '@/utils/systemMessageIcons';
import { getUserRoleColor } from '@/utils/roleColorUtils';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { navigateToMessage, openThreadTab } from '@features/message/messageSlice';
import { selectAuthToken } from '@features/auth/authSlice';

interface SystemMessageRowProps {
  message: Message;
  formattingContext: HtmlFormattingContext;
  guildName?: string;
  guildId?: string | null;
  guildRoles?: any;
  cachedUserMap?: ExportUserMap;
  /** Deep-link flash (#123). Applied when this row is the navigation
   *  target (e.g. a pinned-message notice that was just clicked). */
  highlighted?: boolean;
}

/**
 * Post-render pass that wraps well-known Discord system-message trailing
 * phrases ("See all pinned messages", "See all threads") in a styled
 * anchor so they look like the clickable links Discord renders. The
 * click handler itself is deferred to backlog #123 — for now the anchor
 * is a visual affordance only.
 */
const LINK_PHRASES = ['See all pinned messages', 'See all threads'];
const linkify = (html: string): string => {
  let out = html;
  for (const phrase of LINK_PHRASES) {
    out = out.replace(
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      `<a class="system-link" role="button" tabindex="0">${phrase}</a>`,
    );
  }
  return out;
};

/**
 * Compact Discord-style system-notice row ("Alice pinned a message…",
 * "Bob started a thread: Planning", boost/join/call events, etc.).
 *
 * Visual target: match Discord's rendering exactly:
 *   [icon]  author(role-colored, bold) action text (muted) timestamp(inline)
 *
 * Notes on the parity details:
 * - NOT italic (Discord uses regular weight + muted color).
 * - Timestamp is INLINE at the end of the sentence, not right-aligned.
 * - Author name picks up its role color (same computation used elsewhere).
 * - "See all pinned messages" / "See all threads" are styled as links.
 */
const SystemMessageRow = memo(function SystemMessageRow({
  message,
  formattingContext,
  guildName,
  guildId,
  guildRoles,
  cachedUserMap,
  highlighted = false,
}: SystemMessageRowProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const descriptor = formatSystemMessage(message, {
    guildName: guildName ?? formattingContext.guildName,
  });

  // Delegate clicks on the notice body to the right navigation action
  // based on the system-message kind. Type 6 (pinned) references another
  // message in the channel, type 18 (thread-created) carries a thread
  // object we can open in a new tab. Wired here (rather than in linkify)
  // so the whole notice row — not just the "See all …" anchor — acts as
  // the click target, matching Discord's own behavior.
  const handleNoticeClick = useCallback(() => {
    if (!descriptor) return;
    if (descriptor.kind === 'pin') {
      const targetId = message.message_reference?.message_id;
      if (targetId) dispatch(navigateToMessage({ messageId: targetId }));
    } else if (descriptor.kind === 'thread') {
      const thread = (message as any).thread;
      if (thread?.id && token) {
        dispatch(openThreadTab({
          threadId: thread.id,
          threadName: thread.name || 'Thread',
          token,
        }));
      }
    }
  }, [descriptor, message, token, dispatch]);

  if (!descriptor) return null;

  const Icon = getSystemMessageIcon(descriptor.kind);
  const html = linkify(formatContentAsHtml(descriptor.text, formattingContext));

  const isClickable = descriptor.kind === 'pin' || descriptor.kind === 'thread';

  const roleColor =
    cachedUserMap && guildRoles && message.author?.id
      ? getUserRoleColor(message.author.id, guildId ?? null, cachedUserMap, guildRoles)
      : null;

  // Discord's compact format: "8/28/24, 9:42 PM" — same on all locales in
  // the client. Match it rather than honoring user date-format settings,
  // since system messages are Discord-native and look out of place with
  // the app's regular timestamp format.
  let shortTimestamp = '';
  try {
    shortTimestamp = format(new Date(message.timestamp), 'M/d/yy, h:mm a');
  } catch {
    /* ignore bad timestamps */
  }

  return (
    <Box
      data-testid="system-message-row"
      data-message-id={message.id}
      data-system-kind={descriptor.kind}
      data-highlighted={highlighted ? 'true' : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleNoticeClick : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNoticeClick();
        }
      } : undefined}
      sx={{
        // Outer container mirrors MessageChunk's shell: same `px` +
        // `gap` so the icon column sits where the avatar would, and
        // the text column starts where regular-message content does.
        // Vertical padding matches the export's `.system-message` rule
        // (8px top/bottom) so both renderers feel the same.
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 1,
        minHeight: 36,
        color: 'text.secondary',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        borderRadius: 0.5,
        cursor: isClickable ? 'pointer' : 'default',
        ...(isClickable && {
          '&:hover': { backgroundColor: 'rgba(114, 137, 218, 0.06)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }),
        ...(highlighted && {
          animation: 'deeplink-flash-system 2s ease-out',
          '@keyframes deeplink-flash-system': {
            '0%': { backgroundColor: 'rgba(250, 166, 26, 0.45)' },
            '100%': { backgroundColor: 'transparent' },
          },
        }),
      }}
    >
      {/* Icon column — 40px wide, matches <Avatar width=40> in MessageChunk
          so the icon sits centered where a regular message's avatar sits. */}
      <Box
        sx={{
          width: 40,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon
          // @ts-expect-error — MUI icon components accept `sx` at runtime
          sx={{ fontSize: 18, color: 'text.disabled' }}
        />
      </Box>

      {/* Text column — flex:1 so it fills the content region. The text
          and inline timestamp flow on a single line (or wrap, on narrow
          viewports) so the whole notice reads like Discord's. */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 1,
        }}
      >
        <Typography
          component="span"
          data-testid="system-message-text"
          sx={{
            minWidth: 0,
            fontSize: 'inherit',
            color: 'text.secondary',
            // Author bold — first <strong> in the rendered template —
            // picks up the role color when available. Later <strong>
            // tokens (thread names, etc.) stay primary.
            '& strong:first-of-type': {
              color: roleColor || theme.palette.text.primary,
              fontWeight: 600,
            },
            '& strong': {
              fontWeight: 600,
              color: theme.palette.text.primary,
            },
            '& .system-link': {
              color: theme.palette.primary.main,
              cursor: 'pointer',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            '& .user-mention, & .role-mention': {
              background:
                theme.palette.mode === 'dark'
                  ? 'rgba(88, 101, 242, 0.25)'
                  : 'rgba(88, 101, 242, 0.12)',
              color: theme.palette.primary.main,
              padding: '0 3px',
              borderRadius: '3px',
            },
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {shortTimestamp && (
          <Typography
            component="span"
            data-testid="system-message-timestamp"
            sx={{
              flexShrink: 0,
              fontSize: '0.72rem',
              color: 'text.disabled',
              whiteSpace: 'nowrap',
            }}
          >
            {shortTimestamp}
          </Typography>
        )}
        {descriptor.showEmbed && message.embeds && message.embeds.length > 0 && (
          <Box
            data-testid="system-message-embed"
            sx={{ pt: 0.5, flexBasis: '100%' }}
            dangerouslySetInnerHTML={{
              __html: message.embeds
                .map((e) =>
                  renderEmbedAsHtml(e, {
                    includeImages: true,
                    includeVideos: true,
                  }),
                )
                .join(''),
            }}
          />
        )}
      </Box>
    </Box>
  );
});

export default SystemMessageRow;
