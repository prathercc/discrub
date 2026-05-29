import { memo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  VolumeUp as AudioIcon,
} from '@mui/icons-material';
import type { Message, Attachment, Embed } from 'discrub-core/types/discord-types';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import { formatEmbedContent } from '@/utils/messageLightFormatting';
import { reserveMediaBox } from '@/utils/reserveMediaBox';

const isImageAttachment = (a: Attachment): boolean => {
  const ct = (a.content_type || '').toLowerCase();
  const ext = (a.filename || '').split('.').pop()?.toLowerCase() || '';
  return (
    ct.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)
  );
};

const isVideoAttachment = (a: Attachment): boolean => {
  const ct = (a.content_type || '').toLowerCase();
  const ext = (a.filename || '').split('.').pop()?.toLowerCase() || '';
  return (
    ct.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext)
  );
};

const isAudioAttachment = (a: Attachment): boolean => {
  const ct = (a.content_type || '').toLowerCase();
  const ext = (a.filename || '').split('.').pop()?.toLowerCase() || '';
  return (
    ct.startsWith('audio/') || ['mp3', 'ogg', 'wav', 'm4a', 'flac'].includes(ext)
  );
};

const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ───────────────────────── Inline attachments ───────────────────────── */

interface InlineAttachmentsProps {
  attachments: Attachment[];
  onOpenGallery?: () => void;
}

export const InlineAttachments = memo(function InlineAttachments({
  attachments,
  onOpenGallery,
}: InlineAttachmentsProps) {
  if (!attachments?.length) return null;

  return (
    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
      {attachments.map((a) => {
        if (isImageAttachment(a)) {
          return (
            <Box
              key={a.id}
              role={onOpenGallery ? 'button' : undefined}
              tabIndex={onOpenGallery ? 0 : undefined}
              aria-label={onOpenGallery ? 'View Attachments' : undefined}
              onClick={onOpenGallery}
              onKeyDown={(e) => {
                if (onOpenGallery && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onOpenGallery();
                }
              }}
              sx={{
                display: 'inline-block',
                cursor: onOpenGallery ? 'pointer' : 'default',
                borderRadius: 1,
                transition: 'opacity 150ms ease',
                '&:hover': onOpenGallery ? { opacity: 0.85 } : undefined,
              }}
            >
              <Box
                component="img"
                src={a.proxy_url || a.url}
                alt={a.filename}
                sx={{
                  ...reserveMediaBox(a, 300, 400),
                  borderRadius: 1,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </Box>
          );
        }

        if (isVideoAttachment(a)) {
          return (
            <Box
              key={a.id}
              component="video"
              controls
              src={a.proxy_url || a.url}
              sx={{
                ...reserveMediaBox(a, 300, 400),
                borderRadius: 1,
                display: 'block',
              }}
            />
          );
        }

        if (isAudioAttachment(a)) {
          return (
            <Box
              key={a.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                maxWidth: 400,
              }}
            >
              <AudioIcon fontSize="small" color="action" />
              <Box component="audio" controls src={a.proxy_url || a.url} sx={{ flex: 1 }} />
            </Box>
          );
        }

        return (
          <Chip
            key={a.id}
            icon={<FileIcon />}
            label={
              <Box sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'baseline' }}>
                <Typography variant="body2" component="span">
                  {a.filename}
                </Typography>
                {a.size ? (
                  <Typography variant="caption" color="text.secondary" component="span">
                    · {formatFileSize(a.size)}
                  </Typography>
                ) : null}
              </Box>
            }
            component="a"
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            deleteIcon={<DownloadIcon />}
            onDelete={() => {
              window.open(a.url, '_blank', 'noopener,noreferrer');
            }}
            sx={{
              maxWidth: 'max-content',
              bgcolor: 'action.hover',
              '& .MuiChip-label': { display: 'inline-flex' },
            }}
          />
        );
      })}
    </Stack>
  );
});

/* ───────────────────────── Inline embeds ───────────────────────── */

interface InlineEmbedsProps {
  embeds: Embed[];
  formattingContext?: HtmlFormattingContext;
}

export const InlineEmbeds = memo(function InlineEmbeds({
  embeds,
  formattingContext,
}: InlineEmbedsProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!embeds?.length) return null;

  const ctx = formattingContext ?? ({ userMap: {} } as HtmlFormattingContext);

  const mentionStyles = {
    '& .user-mention': {
      background: isDark ? 'rgba(88, 101, 242, 0.3)' : 'rgba(88, 101, 242, 0.15)',
      color: isDark ? '#c9d1ff' : theme.palette.primary.main,
      padding: '0 2px',
      borderRadius: '3px',
      fontWeight: 500,
    },
    '& .channel-mention': {
      background: isDark ? 'rgba(60, 66, 112, 0.5)' : 'rgba(60, 66, 112, 0.15)',
      color: isDark ? '#b5c7ff' : theme.palette.primary.dark,
      padding: '0 2px',
      borderRadius: '3px',
      fontWeight: 500,
    },
    '& .role-mention': {
      background: isDark ? 'rgba(88, 101, 242, 0.3)' : 'rgba(88, 101, 242, 0.15)',
      color: isDark ? '#c9d1ff' : theme.palette.primary.main,
      padding: '0 2px',
      borderRadius: '3px',
      fontWeight: 500,
    },
    '& .custom-emoji': {
      width: 18,
      height: 18,
      verticalAlign: 'middle',
      margin: '0 1px',
    },
    '& a': {
      color: isDark ? '#00b0f4' : '#0969da',
      textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' },
    },
  } as const;

  return (
    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
      {embeds.map((embed, index) => (
        <Card
          key={index}
          variant="outlined"
          sx={{
            maxWidth: 520,
            borderLeft: embed.color
              ? `4px solid #${embed.color.toString(16).padStart(6, '0')}`
              : '4px solid',
            borderLeftColor: embed.color ? undefined : 'divider',
          }}
        >
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {embed.author?.name && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {embed.author.name}
                  </Typography>
                )}
                {embed.title && (
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                    {embed.url ? (
                      <Link href={embed.url} target="_blank" rel="noopener noreferrer">
                        {embed.title}
                      </Link>
                    ) : (
                      embed.title
                    )}
                  </Typography>
                )}
                {embed.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    component="div"
                    sx={{ ...mentionStyles, lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{
                      __html: formatEmbedContent(embed.description, ctx),
                    }}
                  />
                )}
                {embed.fields && embed.fields.length > 0 && (
                  <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    {embed.fields.map((field, fieldIndex) => (
                      <Box
                        key={fieldIndex}
                        sx={{
                          gridColumn: field.inline ? 'auto' : '1 / -1',
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }}>
                          {field.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="div"
                          sx={{ ...mentionStyles }}
                          dangerouslySetInnerHTML={{
                            __html: formatEmbedContent(field.value, ctx),
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
              {embed.thumbnail?.url && (embed.image?.url || embed.fields?.length) && (
                <Box
                  component="img"
                  src={embed.thumbnail.proxy_url || embed.thumbnail.url}
                  alt=""
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 0.5,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              )}
            </Box>
            {embed.image?.url && (
              <Box
                component="img"
                src={embed.image.proxy_url || embed.image.url}
                alt=""
                sx={{
                  ...reserveMediaBox(embed.image, 300),
                  borderRadius: 0.5,
                  display: 'block',
                  mt: 1,
                }}
              />
            )}
            {embed.thumbnail?.url && !embed.image?.url && !embed.video?.url && !embed.fields?.length && (
              <Box
                component="img"
                src={embed.thumbnail.proxy_url || embed.thumbnail.url}
                alt=""
                sx={{
                  ...reserveMediaBox(embed.thumbnail, 240),
                  borderRadius: 0.5,
                  display: 'block',
                  mt: 1,
                }}
              />
            )}
            {embed.video?.url && (
              (embed.video.url.includes('.mp4') || embed.video.url.includes('.webm')) ? (
                <Box
                  component="video"
                  controls
                  src={embed.video.proxy_url || embed.video.url}
                  sx={{
                    ...reserveMediaBox(embed.video, 300),
                    borderRadius: 0.5,
                    display: 'block',
                    mt: 1,
                  }}
                />
              ) : (
                <Link
                  href={embed.url || embed.video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1 }}
                >
                  <PlayIcon fontSize="small" /> View video
                </Link>
              )
            )}
            {embed.footer && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                {embed.footer.text}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
});

/* ───────────────────────── Inline reactions ───────────────────────── */

interface InlineReactionsProps {
  reactions: NonNullable<Message['reactions']>;
  onReactionClick?: () => void;
}

export const InlineReactions = memo(function InlineReactions({
  reactions,
  onReactionClick,
}: InlineReactionsProps) {
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  if (!reactions?.length) return null;

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}
    >
      {reactions.map((r, i) => {
        const emoji = r.emoji;
        const key = emoji?.id ? String(emoji.id) : (emoji?.name ?? String(i));
        const meReacted = (r as { me?: boolean }).me === true;
        const failed = imgFailed[key];
        return (
          <Box
            key={key}
            role={onReactionClick ? 'button' : undefined}
            tabIndex={onReactionClick ? 0 : undefined}
            aria-label={onReactionClick ? 'View Reactions' : undefined}
            onClick={onReactionClick}
            onKeyDown={(e) => {
              if (onReactionClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onReactionClick();
              }
            }}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: meReacted ? 'primary.50' : 'action.hover',
              border: meReacted ? '1px solid' : '1px solid transparent',
              borderColor: meReacted ? 'primary.main' : 'transparent',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: onReactionClick ? 'pointer' : 'default',
              transition: 'background-color 100ms ease, border-color 100ms ease',
              '&:hover': onReactionClick
                ? { backgroundColor: 'action.selected' }
                : undefined,
            }}
          >
            {emoji?.id && !failed ? (
              <Box
                component="img"
                src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}?size=32`}
                alt={emoji.name ?? ''}
                onError={() => setImgFailed((s) => ({ ...s, [key]: true }))}
                sx={{ width: 16, height: 16, verticalAlign: 'middle' }}
              />
            ) : (
              <span>{emoji?.name ?? '?'}</span>
            )}
            <span>{r.count ?? 0}</span>
          </Box>
        );
      })}
    </Stack>
  );
});
