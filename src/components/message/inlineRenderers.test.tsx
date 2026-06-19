import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { Attachment, Embed } from 'discrub-core/types/discord-types';
import { InlineAttachments, InlineEmbeds, InlineSticker, InlinePoll } from './inlineRenderers';
import { reserveMediaBox } from '@/utils/reserveMediaBox';

// Wrap the real helper in a spy so we can assert each media site reserves
// layout space with the right intrinsic dimensions + caps (#190), while
// still applying the real styles to the rendered element.
vi.mock('@/utils/reserveMediaBox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/reserveMediaBox')>();
  return { ...actual, reserveMediaBox: vi.fn(actual.reserveMediaBox) };
});

const reserveSpy = reserveMediaBox as unknown as Mock;

const attachment = (over: Partial<Attachment>): Attachment =>
  ({
    id: '1',
    filename: 'pic.png',
    content_type: 'image/png',
    url: 'https://cdn.discordapp.com/attachments/1/2/pic.png',
    proxy_url: 'https://media.discordapp.net/attachments/1/2/pic.png',
    size: 1234,
    width: 800,
    height: 600,
    ...over,
  }) as Attachment;

beforeEach(() => reserveSpy.mockClear());

describe('InlineAttachments media reservation (#190)', () => {
  it('reserves the box for an image attachment using its intrinsic size + 400x300 cap', () => {
    const { container } = render(<InlineAttachments attachments={[attachment({})]} />);
    expect(reserveSpy).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 600 }), 300, 400);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('reserves the box for a video attachment with the same cap', () => {
    render(
      <InlineAttachments
        attachments={[attachment({ filename: 'clip.mp4', content_type: 'video/mp4' })]}
      />,
    );
    expect(reserveSpy).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 600 }), 300, 400);
  });

  it('still renders (via fallback) when the attachment has no dimensions', () => {
    const { container } = render(
      <InlineAttachments attachments={[attachment({ width: undefined, height: undefined })]} />,
    );
    expect(reserveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ width: undefined, height: undefined }),
      300,
      400,
    );
    expect(container.querySelector('img')).toBeInTheDocument();
  });
});

describe('InlineEmbeds media reservation (#190)', () => {
  it('reserves the box for a full embed image (height-capped, container width)', () => {
    const embed = {
      type: 'rich',
      image: { url: 'https://example.com/i.png', width: 1000, height: 500 },
    } as unknown as Embed;
    render(<InlineEmbeds embeds={[embed]} />);
    // height cap 300, no width cap (container-width media)
    expect(reserveSpy).toHaveBeenCalledWith(expect.objectContaining({ width: 1000, height: 500 }), 300);
  });

  it('reserves the box for a standalone embed thumbnail with the 240 height cap', () => {
    const embed = {
      type: 'link',
      thumbnail: { url: 'https://example.com/t.png', width: 200, height: 200 },
    } as unknown as Embed;
    render(<InlineEmbeds embeds={[embed]} />);
    expect(reserveSpy).toHaveBeenCalledWith(expect.objectContaining({ width: 200, height: 200 }), 240);
  });
});

describe('InlineSticker (#213)', () => {
  it('renders a PNG sticker as a CDN image', () => {
    render(<InlineSticker stickers={[{ id: '123', name: 'wave', format_type: 1 }]} />);
    const img = screen.getByAltText('wave') as HTMLImageElement;
    expect(img.src).toBe('https://media.discordapp.net/stickers/123.png');
  });

  it('uses the .gif variant for GIF stickers (format_type 4)', () => {
    render(<InlineSticker stickers={[{ id: '456', name: 'dance', format_type: 4 }]} />);
    const img = screen.getByAltText('dance') as HTMLImageElement;
    expect(img.src).toBe('https://media.discordapp.net/stickers/456.gif');
  });

  it('falls back to a labeled placeholder for Lottie stickers (format_type 3)', () => {
    render(<InlineSticker stickers={[{ id: '789', name: 'sparkle', format_type: 3 }]} />);
    expect(screen.queryByAltText('sparkle')).toBeNull(); // no <img>
    expect(screen.getByText('sparkle')).toBeInTheDocument();
  });

  it('renders nothing when there are no stickers', () => {
    const { container } = render(<InlineSticker stickers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('InlinePoll (#213)', () => {
  const poll = {
    question: { text: 'Best language?' },
    answers: [
      { answer_id: 1, poll_media: { text: 'TypeScript' } },
      { answer_id: 2, poll_media: { text: 'Rust' } },
    ],
  };

  it('renders the question and answer options', () => {
    render(<InlinePoll poll={poll} />);
    expect(screen.getByTestId('inline-poll')).toBeInTheDocument();
    expect(screen.getByText('Best language?')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  it('shows percentages and total votes when results are present', () => {
    render(
      <InlinePoll
        poll={{
          ...poll,
          results: { answer_counts: [{ id: 1, count: 3 }, { id: 2, count: 1 }] },
        }}
      />
    );
    expect(screen.getByText('75%')).toBeInTheDocument(); // 3 of 4
    expect(screen.getByText('25%')).toBeInTheDocument(); // 1 of 4
    expect(screen.getByText('4 votes')).toBeInTheDocument();
  });

  it('degrades to plain options when results are absent (no fabricated counts)', () => {
    render(<InlinePoll poll={poll} />);
    expect(screen.queryByText(/%$/)).toBeNull();
    expect(screen.queryByText(/votes?$/)).toBeNull();
  });

  it('renders nothing for a null poll', () => {
    const { container } = render(<InlinePoll poll={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
