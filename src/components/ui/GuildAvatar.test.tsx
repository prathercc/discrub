import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuildAvatar } from './GuildAvatar';

describe('GuildAvatar', () => {
  it('renders the Discord CDN icon URL when guild.icon is set', () => {
    render(
      <GuildAvatar
        guild={{ id: '12345', name: 'Test Server', icon: 'abc123' }}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/icons/12345/abc123.png',
    );
  });

  it('falls back to the initial letter when icon is null', () => {
    render(
      <GuildAvatar guild={{ id: '12345', name: 'Test Server', icon: null }} />,
    );
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders "?" when guild is null/undefined', () => {
    render(<GuildAvatar guild={null} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('uppercases the initial letter regardless of input casing', () => {
    render(<GuildAvatar guild={{ id: '1', name: 'lowercase', icon: null }} />);
    expect(screen.getByText('L')).toBeInTheDocument();
  });
});
