import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  categorizeAttachment,
  categorizeMessageAttachments,
  getTotalMediaSize,
} from './mediaUtils';
import { createMockMessage, createMockAttachment, createMockEmbed } from '@/test/fixtures';

describe('mediaUtils', () => {
  describe('formatBytes', () => {
    it('returns "0 Bytes" for 0', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('returns correct KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('returns correct MB', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('returns correct GB', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('respects decimal parameter', () => {
      expect(formatBytes(1536, 2)).toBe('1.5 KB');
      expect(formatBytes(2048, 2)).toBe('2 KB');
    });
  });

  describe('categorizeAttachment', () => {
    it('.png -> images', () => {
      expect(categorizeAttachment('photo.png')).toBe('images');
    });

    it('.mp4 -> videos', () => {
      expect(categorizeAttachment('clip.mp4')).toBe('videos');
    });

    it('.mp3 -> audio', () => {
      expect(categorizeAttachment('song.mp3')).toBe('audio');
    });

    it('.pdf -> other', () => {
      expect(categorizeAttachment('doc.pdf')).toBe('other');
    });

    it('is case-insensitive', () => {
      expect(categorizeAttachment('FILE.PNG')).toBe('images');
    });

    it('no extension -> other', () => {
      expect(categorizeAttachment('noext')).toBe('other');
    });
  });

  describe('categorizeMessageAttachments', () => {
    it('groups attachments correctly', () => {
      const messages = [
        createMockMessage({
          attachments: [
            createMockAttachment({ filename: 'a.png', size: 100 }),
            createMockAttachment({ filename: 'b.jpg', size: 200 }),
            createMockAttachment({ filename: 'c.mp4', size: 300 }),
          ],
        }),
      ];

      const result = categorizeMessageAttachments(messages);
      const images = result.find((s) => s.category === 'images');
      const videos = result.find((s) => s.category === 'videos');

      expect(images?.count).toBe(2);
      expect(videos?.count).toBe(1);
    });

    it('sums sizes per category', () => {
      const messages = [
        createMockMessage({
          attachments: [
            createMockAttachment({ filename: 'a.png', size: 100 }),
            createMockAttachment({ filename: 'b.png', size: 200 }),
          ],
        }),
      ];

      const result = categorizeMessageAttachments(messages);
      const images = result.find((s) => s.category === 'images');
      expect(images?.totalBytes).toBe(300);
    });

    it('includes embed images in embedCount', () => {
      const messages = [
        createMockMessage({
          embeds: [
            createMockEmbed({ image: { url: 'https://example.com/img.png', proxy_url: '', height: 100, width: 100 } }),
          ],
        }),
      ];

      const result = categorizeMessageAttachments(messages);
      const images = result.find((s) => s.category === 'images');
      expect(images?.embedCount).toBe(1);
    });

    it('includes embed videos in embedCount', () => {
      const messages = [
        createMockMessage({
          embeds: [
            createMockEmbed({ video: { url: 'https://example.com/vid.mp4', proxy_url: '', height: 100, width: 100 } }),
          ],
        }),
      ];

      const result = categorizeMessageAttachments(messages);
      const videos = result.find((s) => s.category === 'videos');
      expect(videos?.embedCount).toBe(1);
    });

    it('handles no attachments', () => {
      const messages = [createMockMessage()];
      const result = categorizeMessageAttachments(messages);
      expect(result).toEqual([]);
    });

    it('tracks embeds separately (embedCount only, no size impact)', () => {
      const messages = [
        createMockMessage({
          attachments: [
            createMockAttachment({ filename: 'a.png', size: 500 }),
          ],
          embeds: [
            createMockEmbed({ image: { url: 'https://example.com/img.png', proxy_url: '', height: 100, width: 100 } }),
          ],
        }),
      ];

      const result = categorizeMessageAttachments(messages);
      const images = result.find((s) => s.category === 'images');
      expect(images?.count).toBe(1);
      expect(images?.totalBytes).toBe(500);
      expect(images?.embedCount).toBe(1);
    });
  });

  describe('getTotalMediaSize', () => {
    it('sums all categories', () => {
      const summaries = [
        { category: 'images' as const, count: 2, totalBytes: 1000, embedCount: 0, attachments: [] },
        { category: 'videos' as const, count: 1, totalBytes: 2000, embedCount: 0, attachments: [] },
      ];
      expect(getTotalMediaSize(summaries)).toBe(3000);
    });
  });
});
