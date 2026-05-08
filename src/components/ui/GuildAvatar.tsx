import { Avatar, type AvatarProps } from '@mui/material';
import type { Guild } from 'discrub-core/types/discord-types';

interface GuildAvatarProps extends Omit<AvatarProps, 'src' | 'children'> {
  guild: Pick<Guild, 'id' | 'name' | 'icon'> | null | undefined;
  /** Pixel size for both width and height. Defaults to 40 to match ServerList. */
  size?: number;
}

/**
 * Server icon avatar (#166). Reuses Discord's CDN URL pattern when
 * the guild has an `icon` hash; falls back to the initial letter
 * otherwise. Encapsulating the URL-construction here keeps every
 * caller — ServerList, the channel-list header in Sidebar — from
 * re-deriving the same string in slightly different ways.
 *
 * Inherits all other Avatar props (sx, variant, className) so callers
 * can size or restyle without losing the icon resolution behavior.
 */
export const GuildAvatar = ({ guild, size = 40, sx, ...rest }: GuildAvatarProps) => {
  const src = guild?.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
    : undefined;
  const initial = guild?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <Avatar
      src={src}
      sx={{ width: size, height: size, ...(sx as object) }}
      {...rest}
    >
      {initial}
    </Avatar>
  );
};

export default GuildAvatar;
