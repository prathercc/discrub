import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MediaPreviewPanel from './MediaPreviewPanel';
import type { MediaCategorySummary } from '@/utils/mediaUtils';
import { createMockAttachment } from '@/test/fixtures';

describe('MediaPreviewPanel', () => {
  it('renders nothing for empty data', () => {
    const { container } = render(<MediaPreviewPanel summaries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no attachments', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 0, totalBytes: 0, embedCount: 2, attachments: [] },
    ];
    const { container } = render(<MediaPreviewPanel summaries={summaries} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows collapsible header', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 1, totalBytes: 1000, embedCount: 0, attachments: [createMockAttachment()] },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    expect(screen.getByText('Preview attachments')).toBeInTheDocument();
  });

  it('shows image thumbnails on expand', () => {
    const summaries: MediaCategorySummary[] = [
      {
        category: 'images',
        count: 1,
        totalBytes: 1000,
        embedCount: 0,
        attachments: [createMockAttachment({ proxy_url: 'https://media.discordapp.net/test.png' })],
      },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('limits to 8 per category with +N chip', () => {
    const attachments = Array.from({ length: 12 }, (_, i) =>
      createMockAttachment({ id: `att-${i}`, filename: `img${i}.png`, proxy_url: `https://media.discordapp.net/${i}.png` })
    );
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 12, totalBytes: 12000, embedCount: 0, attachments },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    expect(screen.getByText('+4 more')).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBe(8);
  });

  it('caps total items across categories to 20', () => {
    const makeAttachments = (count: number, prefix: string) =>
      Array.from({ length: count }, (_, i) =>
        createMockAttachment({ id: `${prefix}-${i}`, filename: `${prefix}${i}.png`, proxy_url: `https://media.discordapp.net/${prefix}${i}.png` })
      );
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 8, totalBytes: 8000, embedCount: 0, attachments: makeAttachments(8, 'img') },
      { category: 'videos', count: 8, totalBytes: 8000, embedCount: 0, attachments: makeAttachments(8, 'vid') },
      { category: 'audio', count: 8, totalBytes: 8000, embedCount: 0, attachments: makeAttachments(8, 'aud') },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    // 8 images + 8 videos + 4 audio = 20 total (capped)
    const allImages = screen.getAllByRole('img');
    const allChips = screen.getAllByText(/\.png/);
    // Images render as <img>, videos/audio render as Chips
    expect(allImages.length + allChips.length).toBeLessThanOrEqual(20);
    // Audio should have a "+N more" chip since it got capped
    expect(screen.getByText('+4 more')).toBeInTheDocument();
  });

  it('shows chip-style items for videos', () => {
    const summaries: MediaCategorySummary[] = [
      {
        category: 'videos',
        count: 1,
        totalBytes: 5000,
        embedCount: 0,
        attachments: [createMockAttachment({ filename: 'clip.mp4' })],
      },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
  });

  it('shows capitalized category headers', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 1, totalBytes: 1000, embedCount: 0, attachments: [createMockAttachment()] },
      { category: 'videos', count: 1, totalBytes: 1000, embedCount: 0, attachments: [createMockAttachment({ filename: 'clip.mp4' })] },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
  });

  it('uses proxy_url for img src', () => {
    const proxyUrl = 'https://media.discordapp.net/special.png';
    const summaries: MediaCategorySummary[] = [
      {
        category: 'images',
        count: 1,
        totalBytes: 1000,
        embedCount: 0,
        attachments: [createMockAttachment({ proxy_url: proxyUrl })],
      },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe(proxyUrl);
  });

  it('adds loading="lazy" to image thumbnails', () => {
    const summaries: MediaCategorySummary[] = [
      {
        category: 'images',
        count: 1,
        totalBytes: 1000,
        embedCount: 0,
        attachments: [createMockAttachment({ proxy_url: 'https://media.discordapp.net/test.png' })],
      },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('broken image shows fallback icon', () => {
    const summaries: MediaCategorySummary[] = [
      {
        category: 'images',
        count: 1,
        totalBytes: 1000,
        embedCount: 0,
        attachments: [createMockAttachment({ proxy_url: 'https://broken.url/img.png' })],
      },
    ];
    render(<MediaPreviewPanel summaries={summaries} />);
    fireEvent.click(screen.getByText('Preview attachments'));
    const img = screen.getByRole('img');
    fireEvent.error(img);
    // After error, the img should be replaced with BrokenImage icon
    expect(screen.queryByRole('img')).toBeNull();
  });
});
