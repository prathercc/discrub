import type { Message, Attachment } from 'discrub-core/types/discord-types';
import { IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS } from '@/constants/mediaExtensions';

export type MediaCategory = 'images' | 'videos' | 'audio' | 'other';

export interface MediaCategorySummary {
  category: MediaCategory;
  count: number;
  totalBytes: number;
  embedCount: number;
  attachments: Attachment[];
}

export const SIZE_WARNING_THRESHOLD = 100 * 1024 * 1024; // 100 MB

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${parseFloat(value.toFixed(decimals))} ${sizes[i]}`;
}

export function categorizeAttachment(filename: string): MediaCategory {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return 'images';
  if (VIDEO_EXTS.includes(ext)) return 'videos';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  return 'other';
}

export function categorizeMessageAttachments(messages: Message[]): MediaCategorySummary[] {
  const summaryMap: Record<MediaCategory, MediaCategorySummary> = {
    images: { category: 'images', count: 0, totalBytes: 0, embedCount: 0, attachments: [] },
    videos: { category: 'videos', count: 0, totalBytes: 0, embedCount: 0, attachments: [] },
    audio: { category: 'audio', count: 0, totalBytes: 0, embedCount: 0, attachments: [] },
    other: { category: 'other', count: 0, totalBytes: 0, embedCount: 0, attachments: [] },
  };

  for (const msg of messages) {
    // Process attachments
    for (const att of msg.attachments || []) {
      const category = categorizeAttachment(att.filename || 'unknown');
      summaryMap[category].count++;
      summaryMap[category].totalBytes += att.size || 0;
      summaryMap[category].attachments.push(att);
    }

    // Process embeds — count only, no size contribution
    for (const embed of msg.embeds || []) {
      if (embed.image?.url) {
        summaryMap.images.embedCount++;
      }
      if (embed.video?.url) {
        summaryMap.videos.embedCount++;
      }
      if (embed.thumbnail?.url && !embed.image?.url && !embed.video?.url) {
        summaryMap.images.embedCount++;
      }
    }
  }

  // Return only categories that have content
  return Object.values(summaryMap).filter(
    (s) => s.count > 0 || s.embedCount > 0
  );
}

export function getTotalMediaSize(summaries: MediaCategorySummary[]): number {
  return summaries.reduce((total, s) => total + s.totalBytes, 0);
}
