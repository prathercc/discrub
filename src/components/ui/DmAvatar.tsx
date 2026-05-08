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
 * Recipient avatar for a DM or group DM (#166). Single-recipient DMs
 * render one Avatar with the recipient's icon (or initial fallback).
 * Group DMs render a stacked AvatarGroup that surfaces up to
 * `maxGroup` recipients with the standard "+N" overflow.
 *
 * Mirrors the URL-construction in DMList so the channel-list and the
 * channel-toolbar header pull from the same source of truth.
 */
export const DmAvatar = ({
  dm,
  size = 40,
  maxGroup = 3,
  sx,
  ...rest
}: DmAvatarProps) => {
  const recipients = dm?.recipients ?? [];

  const avatarUrl = (id: string, hash: string | null | undefined) =>
    hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png` : undefined;

  if (recipients.length <= 1) {
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

  // Group DMs — show the first `maxGroup` recipients stacked. MUI
  // AvatarGroup auto-renders a "+N" surrogate when the array is
  // longer than `max`, which is exactly the affordance we want.
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
