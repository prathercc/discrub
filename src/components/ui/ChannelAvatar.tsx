import { Avatar, type AvatarProps } from '@mui/material';
import type { Channel } from 'discrub-core/types/discord-types';

interface ChannelAvatarProps extends Omit<AvatarProps, 'src' | 'children'> {
  channel: Channel | null | undefined;
  /** Pixel size for both width and height. Defaults to 28 to match the in-toolbar use. */
  size?: number;
}

/**
 * Server-channel avatar (#166 follow-up). Discord doesn't expose a
 * per-channel icon for text/voice/forum/stage/announcement/thread
 * channels — the universal "#" hashtag is the conventional marker.
 *
 * This component exists primarily for visual consistency with the
 * `<DmAvatar>` and `<GuildAvatar>` components: every message-feed
 * header now anchors on an avatar to the left of the name, so the
 * eye lands in a predictable spot regardless of channel kind.
 */
export const ChannelAvatar = ({ channel: _channel, size = 28, sx, ...rest }: ChannelAvatarProps) => {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: `${Math.round(size * 0.5)}px`,
        fontWeight: 600,
        ...(sx as object),
      }}
      {...rest}
    >
      #
    </Avatar>
  );
};

export default ChannelAvatar;
