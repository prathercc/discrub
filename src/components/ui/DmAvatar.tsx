import { Avatar, AvatarGroup, Box, type AvatarProps } from '@mui/material';
import type { Channel } from 'discrub-core/types/discord-types';

interface DmAvatarProps extends Omit<AvatarProps, 'src' | 'children'> {
  dm: Channel | null | undefined;
  /** Pixel size for the (single) avatar or each member of the group. Defaults to 40. */
  size?: number;
  /** When the DM has multiple recipients, render up to this many before collapsing. */
  maxGroup?: number;
}

/**
 * Recipient avatar for a DM or group DM (#166, #167).
 *
 * Resolution order:
 *   1. Group DM with a custom `channel.icon` set — render that icon
 *      via Discord's channel-icons CDN. This matches Discord's own
 *      client which surfaces the owner-uploaded icon as the primary
 *      identity for the group.
 *   2. Single-recipient DM — one Avatar with the recipient's icon
 *      (or initial fallback).
 *   3. Group DM without a custom icon — stacked AvatarGroup with
 *      "+N" overflow when recipient count exceeds `maxGroup`.
 *
 * Mirrors the URL construction in DMList so the channel-list and
 * the channel-toolbar header pull from the same source of truth.
 */
export const DmAvatar = ({
  dm,
  size = 40,
  maxGroup = 3,
  sx,
  ...rest
}: DmAvatarProps) => {
  const recipients = dm?.recipients ?? [];
  // #227: group-ness is the CHANNEL TYPE (3 = GROUP_DM), not the remaining
  // headcount — a group whittled down to one (or zero) remaining recipients
  // is still a group and must not masquerade as a 1:1 DM. Recipient-count
  // fallback kept for data where `type` is absent.
  const isGroup = dm?.type === 3 || recipients.length > 1;

  const avatarUrl = (id: string, hash: string | null | undefined) =>
    hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png` : undefined;

  // Group DM with an owner-uploaded custom icon (#167). The CDN
  // path for these is /channel-icons/, distinct from /avatars/
  // for users and /icons/ for guilds.
  if (isGroup && dm?.icon && dm.id) {
    return (
      <Avatar
        src={`https://cdn.discordapp.com/channel-icons/${dm.id}/${dm.icon}.png`}
        sx={{ width: size, height: size, ...(sx as object) }}
        {...rest}
      >
        {recipients[0]?.username?.[0]?.toUpperCase() ?? '#'}
      </Avatar>
    );
  }

  if (!isGroup && recipients.length <= 1) {
    const r = recipients[0];
    return (
      <Avatar
        src={r ? avatarUrl(r.id, r.avatar) : undefined}
        sx={{ width: size, height: size, ...(sx as object) }}
        {...rest}
      >
        {r?.username?.[0]?.toUpperCase() ?? '#'}
      </Avatar>
    );
  }

  // A group everyone else has left (#227): no recipients to stack, no
  // custom icon — placeholder initial so the row still reads as a group.
  if (recipients.length === 0) {
    return (
      <Avatar sx={{ width: size, height: size, ...(sx as object) }} {...rest}>
        #
      </Avatar>
    );
  }

  // Group DMs without a custom icon — stacked recipients. MUI's
  // AvatarGroup auto-renders a "+N" surrogate when the array is
  // longer than `max`.
  return (
    <Box sx={{ display: 'inline-flex', ...(sx as object) }}>
      <AvatarGroup
        max={maxGroup}
        sx={{
          '& .MuiAvatar-root': {
            width: size,
            height: size,
            fontSize: `${Math.round(size * 0.4)}px`,
          },
        }}
      >
        {recipients.map((r) => (
          <Avatar
            key={r.id}
            src={avatarUrl(r.id, r.avatar)}
            alt={r.username}
            {...rest}
          >
            {r.username?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
        ))}
      </AvatarGroup>
    </Box>
  );
};

export default DmAvatar;
