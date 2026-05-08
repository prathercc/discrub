import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DmAvatar } from './DmAvatar';
import type { Channel, User } from 'discrub-core/types/discord-types';

const recipient = (id: string, name: string, avatar: string | null = null): User =>
  ({ id, username: name, avatar } as User);

describe('DmAvatar', () => {
  it('renders the recipient avatar URL for a 1-on-1 DM', () => {
    const dm = {
      id: 'd1',
      type: 1,
      recipients: [recipient('99', 'friend', 'hash99')],
    } as unknown as Channel;
    render(<DmAvatar dm={dm} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/avatars/99/hash99.png',
    );
  });

  it('falls back to the recipient initial when avatar is null', () => {
    const dm = {
      id: 'd1',
      type: 1,
      recipients: [recipient('99', 'friend', null)],
    } as unknown as Channel;
    render(<DmAvatar dm={dm} />);
    expect(screen.getByText('F')).toBeInTheDocument();
  });

  it('renders an AvatarGroup for group DMs with multiple recipients', () => {
    const dm = {
      id: 'g1',
      type: 3,
      recipients: [
        recipient('1', 'one', 'h1'),
        recipient('2', 'two', 'h2'),
        recipient('3', 'three', 'h3'),
      ],
    } as unknown as Channel;
    render(<DmAvatar dm={dm} />);
    // AvatarGroup renders all three when max defaults to 3 (no overflow).
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBe(3);
  });

  it('shows +N surrogate when group DM has more recipients than maxGroup', () => {
    const dm = {
      id: 'g2',
      type: 3,
      recipients: [
        recipient('1', 'a', null),
        recipient('2', 'b', null),
        recipient('3', 'c', null),
        recipient('4', 'd', null),
        recipient('5', 'e', null),
      ],
    } as unknown as Channel;
    render(<DmAvatar dm={dm} maxGroup={3} />);
    // MUI AvatarGroup renders "+N" for the overflow. With 5 recipients
    // and maxGroup=3, two are stashed under "+2".
    expect(screen.getByText(/\+2|\+3/)).toBeInTheDocument();
  });

  it('renders "#" when dm is null', () => {
    render(<DmAvatar dm={null} />);
    expect(screen.getByText('#')).toBeInTheDocument();
  });

  // Backlog #167: prefer the group-DM custom icon when the channel
  // owner has uploaded one — that's how Discord's own client renders
  // the group's identity, and it matches user expectations better
  // than the recipient stack.
  it('uses the channel-icons CDN URL for a group DM with a custom icon', () => {
    const dm = {
      id: 'group-1',
      type: 3,
      icon: 'iconhash123',
      recipients: [
        recipient('1', 'a', null),
        recipient('2', 'b', null),
        recipient('3', 'c', null),
      ],
    } as unknown as Channel;
    render(<DmAvatar dm={dm} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/channel-icons/group-1/iconhash123.png',
    );
  });

  it('falls back to the recipient stack when group DM has no custom icon', () => {
    const dm = {
      id: 'group-noicon',
      type: 3,
      icon: null,
      recipients: [
        recipient('1', 'a', 'h1'),
        recipient('2', 'b', 'h2'),
      ],
    } as unknown as Channel;
    render(<DmAvatar dm={dm} />);
    expect(screen.getAllByRole('img').length).toBe(2);
  });
});
