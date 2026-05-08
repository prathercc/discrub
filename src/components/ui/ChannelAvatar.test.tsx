import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChannelAvatar } from './ChannelAvatar';
import type { Channel } from 'discrub-core/types/discord-types';

describe('ChannelAvatar', () => {
  it('renders the # marker for any server channel', () => {
    const ch = { id: 'c1', name: 'general', type: 0 } as Channel;
    render(<ChannelAvatar channel={ch} />);
    expect(screen.getByText('#')).toBeInTheDocument();
  });

  it('renders # even when channel is null (defensive default)', () => {
    render(<ChannelAvatar channel={null} />);
    expect(screen.getByText('#')).toBeInTheDocument();
  });

  it('renders an MUI Avatar element regardless of size prop', () => {
    const ch = { id: 'c1', name: 'random', type: 0 } as Channel;
    const { container } = render(<ChannelAvatar channel={ch} size={48} />);
    expect(container.querySelector('.MuiAvatar-root')).not.toBeNull();
  });
});
