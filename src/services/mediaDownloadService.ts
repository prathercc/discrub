import { getDiscordService } from '@services/discordService';
import filenamify from 'filenamify';
import { isExtensionMode } from '@/extension/messaging';
import type { Message, Guild } from 'discrub-core/types/discord-types';
import type { ExportReactionMap } from 'discrub-core/types/discrub-types';
import type { MediaDownloadProgress, MediaMaps, MediaConfig } from '@features/export/exportTypes';
import type { StreamingZipService } from './streamingZipService';
import { IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS } from '@/constants/mediaExtensions';

export type ShouldContinueFn = () => Promise<void>;

/**
 * MediaDownloadService - Orchestrates media downloads with progress tracking
 * Downloads avatars, attachments, emojis, and role icons for offline export
 */
export class MediaDownloadService {
  private maps: MediaMaps = {
    avatarMap: {},
    mediaMap: {},
    emojiMap: {},
    roleMap: {},
  };

  /**
   * Download a file with a 10-second timeout, returning the blob or null on failure
   */
  private async downloadWithTimeout(url: string): Promise<Blob | null> {
    try {
      const discordService = getDiscordService();
      const result = await Promise.race([
        discordService.downloadFile(url),
        new Promise<{ success: boolean; data: null }>((resolve) =>
          setTimeout(() => resolve({ success: false, data: null }), 10000)
        ),
      ]);
      return result.success && result.data ? result.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a filename matches the media config filter
   */
  private shouldDownloadFile(filename: string, mediaConfig?: MediaConfig): boolean {
    if (!mediaConfig) return true;

    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (IMAGE_EXTS.includes(ext)) return mediaConfig.images;
    if (VIDEO_EXTS.includes(ext)) return mediaConfig.videos;
    if (AUDIO_EXTS.includes(ext)) return mediaConfig.audio;
    // Non-media files can only be downloaded in extension mode (CDN direct access)
    if (!isExtensionMode()) return false;
    return mediaConfig.other;
  }

  /**
   * Download all media types for the given messages
   */
  async downloadAllMedia(
    messages: Message[],
    guild: Guild | null,
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    mediaConfig?: MediaConfig,
    artistMode?: boolean,
    shouldContinue?: ShouldContinueFn,
    reactionMap?: ExportReactionMap,
  ): Promise<MediaMaps> {
    // 1. Download avatars (message authors + reaction users)
    await this.downloadAvatars(messages, entityName, zipService, onProgress, shouldContinue, reactionMap);

    // 2. Download attachments (filtered by mediaConfig)
    await this.downloadAttachments(messages, entityName, zipService, onProgress, mediaConfig, artistMode, shouldContinue);

    // 3. Download custom emojis
    await this.downloadEmojis(messages, entityName, zipService, onProgress, shouldContinue);

    // 4. Download stickers (#213)
    await this.downloadStickers(messages, entityName, zipService, onProgress, shouldContinue);

    // 5. Download role icons (if guild export)
    if (guild) {
      await this.downloadRoleIcons(guild, entityName, zipService, onProgress, shouldContinue);
    }

    return this.maps;
  }

  /**
   * Download media only (attachments) without generating content files
   * Used for the "media only" export format
   */
  async downloadMediaOnly(
    messages: Message[],
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    mediaConfig?: MediaConfig,
    artistMode?: boolean,
    shouldContinue?: ShouldContinueFn
  ): Promise<void> {
    await this.downloadAttachments(messages, entityName, zipService, onProgress, mediaConfig, artistMode, shouldContinue);
  }

  /**
   * Download user avatars from messages
   */
  private async downloadAvatars(
    messages: Message[],
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    shouldContinue?: ShouldContinueFn,
    reactionMap?: ExportReactionMap,
  ): Promise<void> {
    // Collect unique user avatars from message authors
    const avatarSet = new Set<string>();
    messages.forEach((msg) => {
      if (msg.author?.id && msg.author.avatar) {
        avatarSet.add(`${msg.author.id}/${msg.author.avatar}`);
      }
    });

    // Also collect avatars from reaction users (if reaction enrichment data is available)
    if (reactionMap) {
      for (const msgReactions of Object.values(reactionMap)) {
        for (const reactors of Object.values(msgReactions)) {
          for (const reactor of reactors) {
            if (reactor.id && reactor.avatar) {
              avatarSet.add(`${reactor.id}/${reactor.avatar}`);
            }
          }
        }
      }
    }

    const avatars = Array.from(avatarSet);
    let downloaded = 0;

    for (const idAndAvatar of avatars) {
      if (shouldContinue) await shouldContinue();
      const [userId, avatarHash] = idAndAvatar.split('/');
      const cdnUrl = `https://media.discordapp.net/avatars/${userId}/${avatarHash}.png`;

      if (!this.maps.avatarMap[idAndAvatar]) {
        const blob = await this.downloadWithTimeout(cdnUrl);
        if (blob) {
          const ext = this.getFileExtension(blob) || 'webp';
          const filePath = `${entityName}/avatars/${userId}/${avatarHash}.${ext}`;
          await zipService.addFile(blob, filePath);
          this.maps.avatarMap[idAndAvatar] = filePath;
        } else {
          console.warn(`Failed to download avatar: ${cdnUrl}`);
        }
      }

      downloaded++;
      onProgress({
        stage: 'avatars',
        current: downloaded,
        total: avatars.length,
        message: `Downloading avatar ${downloaded}/${avatars.length}`,
      });
    }
  }

  /**
   * Download message attachments and embedded media
   */
  private async downloadAttachments(
    messages: Message[],
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    mediaConfig?: MediaConfig,
    artistMode?: boolean,
    shouldContinue?: ShouldContinueFn
  ): Promise<void> {
    // Collect all attachment URLs with type categorization
    const attachmentUrls: Array<{
      url: string;
      downloadUrl: string;
      messageIndex: number;
      filename: string;
      type: 'attachment' | 'embed-image' | 'embed-video' | 'embed-thumbnail';
      authorName: string;
    }> = [];

    const useProxyUrl = !isExtensionMode();

    // Collect attachment + embed media from a single message-like source.
    // Used for the top-level message AND for each forwarded snapshot's
    // payload (#214) so forwarded attachments/embedded images are downloaded
    // and URL-rewritten exactly like top-level media.
    const collectMedia = (
      source: Pick<Message, 'attachments' | 'embeds'> | Partial<Message> | null | undefined,
      authorName: string,
      index: number
    ) => {
      if (!source) return;
      const attachments = source.attachments || [];
      attachments.forEach((att) => {
        if (att.url && this.shouldDownloadFile(att.filename || 'unknown', mediaConfig)) {
          attachmentUrls.push({
            url: att.url,
            downloadUrl: useProxyUrl && att.proxy_url ? att.proxy_url : att.url,
            messageIndex: index,
            filename: att.filename || 'unknown',
            type: 'attachment',
            authorName,
          });
        }
      });

      // Also get media from embeds
      const embeds = source.embeds || [];
      embeds.forEach((embed) => {
        if (embed.image?.url) {
          attachmentUrls.push({
            url: embed.image.url,
            downloadUrl: useProxyUrl && embed.image.proxy_url ? embed.image.proxy_url : embed.image.url,
            messageIndex: index,
            filename: 'embed_image',
            type: 'embed-image',
            authorName,
          });
        }
        if (embed.video?.url) {
          attachmentUrls.push({
            url: embed.video.url,
            downloadUrl: useProxyUrl && embed.video.proxy_url ? embed.video.proxy_url : embed.video.url,
            messageIndex: index,
            filename: 'embed_video',
            type: 'embed-video',
            authorName,
          });
        }
        if (embed.thumbnail?.url) {
          attachmentUrls.push({
            url: embed.thumbnail.url,
            downloadUrl: useProxyUrl && embed.thumbnail.proxy_url ? embed.thumbnail.proxy_url : embed.thumbnail.url,
            messageIndex: index,
            filename: 'embed_thumbnail',
            type: 'embed-thumbnail',
            authorName,
          });
        }
      });
    };

    messages.forEach((msg, index) => {
      const authorName = msg.author?.username || 'unknown';
      collectMedia(msg, authorName, index);

      // #214: forwarded messages (message_reference.type === 1) carry their
      // real payload — including attachments and embedded media — inside
      // message_snapshots[].message, NOT on the top-level message. Without
      // this pass that media is rendered in the feed/HTML but never downloaded,
      // leaving dead CDN links offline.
      msg.message_snapshots?.forEach((snap) => {
        collectMedia(snap?.message, authorName, index);
      });
    });

    // Report progress even if there are no attachments
    if (attachmentUrls.length === 0) {
      onProgress({
        stage: 'attachments',
        current: 0,
        total: 0,
        message: 'No attachments to download',
      });
      return;
    }

    let downloaded = 0;

    for (const { url, downloadUrl, messageIndex, filename, type, authorName } of attachmentUrls) {
      if (shouldContinue) await shouldContinue();
      if (!this.maps.mediaMap[url]) {
        // Try the preferred URL first (usually Discord's proxy in web mode).
        // Fall back to the direct URL if the proxy returns nothing — Discord's
        // media proxy reliably serves images but has historically been flaky
        // for external video CDNs (Tenor mp4s in particular). The CORS
        // characteristics of the direct URL matter too; both attempts are
        // cross-origin and the fetch will fail silently if headers don't
        // allow it.
        let blob = await this.downloadWithTimeout(downloadUrl);
        if (!blob && downloadUrl !== url) {
          blob = await this.downloadWithTimeout(url);
        }
        if (blob) {
          const ext = this.getFileExtension(blob) || this.getExtensionFromFilename(filename);
          const sanitizedFilename = filenamify(`${messageIndex}_${Date.now()}.${ext}`, {
            replacement: '_',
          });

          let filePath: string;
          let relativePath: string;
          if (artistMode) {
            const safeAuthor = filenamify(authorName, { replacement: '_' });
            filePath = `${entityName}/media/${safeAuthor}/${sanitizedFilename}`;
            relativePath = `media/${safeAuthor}/${sanitizedFilename}`;
          } else {
            const typeFolder = type === 'attachment' ? 'attachments' : type + 's';
            filePath = `${entityName}/media/${typeFolder}/${sanitizedFilename}`;
            relativePath = `media/${typeFolder}/${sanitizedFilename}`;
          }

          await zipService.addFile(blob, filePath);
          this.maps.mediaMap[url] = relativePath;
        } else {
          console.warn(
            `[mediaDownloadService] Failed to download ${type}`,
            { original: url, attempted: downloadUrl },
          );
        }
      }

      downloaded++;
      onProgress({
        stage: 'attachments',
        current: downloaded,
        total: attachmentUrls.length,
        message: `Downloading attachment ${downloaded}/${attachmentUrls.length}`,
      });
    }
  }

  /**
   * Download custom emojis from message content
   */
  private async downloadEmojis(
    messages: Message[],
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    shouldContinue?: ShouldContinueFn
  ): Promise<void> {
    // Extract custom emoji IDs from message content AND reactions
    const emojiIds = new Set<string>();
    const emojiRegex = /<(a)?:(\w+):(\d+)>/g;

    messages.forEach((msg) => {
      // Extract from content
      let match;
      while ((match = emojiRegex.exec(msg.content || '')) !== null) {
        const emojiId = match[3]; // emoji ID
        emojiIds.add(emojiId);
      }

      // Extract from reactions
      msg.reactions?.forEach((reaction) => {
        if (reaction.emoji?.id) {
          emojiIds.add(reaction.emoji.id);
        }
      });
    });

    const emojis = Array.from(emojiIds);

    // Report progress even if there are no emojis
    if (emojis.length === 0) {
      onProgress({
        stage: 'emojis',
        current: 0,
        total: 0,
        message: 'No emojis to download',
      });
      return;
    }

    let downloaded = 0;

    for (const emojiId of emojis) {
      if (shouldContinue) await shouldContinue();
      // Download as webp with animated parameter
      const cdnUrl = `https://media.discordapp.net/emojis/${emojiId}.webp?animated=true`;

      if (!this.maps.emojiMap[emojiId]) {
        const blob = await this.downloadWithTimeout(cdnUrl);
        if (blob) {
          const ext = this.getFileExtension(blob) || 'webp';
          const filePath = `${entityName}/emojis/${emojiId}.${ext}`;
          await zipService.addFile(blob, filePath);
          this.maps.emojiMap[emojiId] = filePath;
        } else {
          console.warn(`Failed to download emoji: ${cdnUrl}`);
        }
      }

      downloaded++;
      onProgress({
        stage: 'emojis',
        current: downloaded,
        total: emojis.length,
        message: `Downloading emoji ${downloaded}/${emojis.length}`,
      });
    }
  }

  /**
   * Download message stickers into the offline bundle (#213). Raster stickers
   * (PNG/APNG/GIF) become stickers/{id}.{ext}; Lottie (format_type 3) is skipped
   * — it can't be an <img>, so the emitter renders a placeholder instead. The
   * file path is deterministic and matches the exportService sticker emitter.
   */
  private async downloadStickers(
    messages: Message[],
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    shouldContinue?: ShouldContinueFn
  ): Promise<void> {
    const stickers = new Map<string, { id: string; format_type: number }>();
    messages.forEach((msg) => {
      (msg as { sticker_items?: Array<{ id: string; format_type: number }> }).sticker_items?.forEach((s) => {
        if (s.format_type !== 3) stickers.set(s.id, s); // skip Lottie
      });
    });

    const items = Array.from(stickers.values());
    if (items.length === 0) {
      onProgress({ stage: 'stickers', current: 0, total: 0, message: 'No stickers to download' });
      return;
    }

    let downloaded = 0;
    for (const s of items) {
      if (shouldContinue) await shouldContinue();
      const ext = s.format_type === 4 ? 'gif' : 'png';
      const cdnUrl = `https://media.discordapp.net/stickers/${s.id}.${ext}`;
      const filePath = `${entityName}/stickers/${s.id}.${ext}`;
      const blob = await this.downloadWithTimeout(cdnUrl);
      if (blob) {
        await zipService.addFile(blob, filePath);
      } else {
        console.warn(`Failed to download sticker: ${cdnUrl}`);
      }
      downloaded++;
      onProgress({
        stage: 'stickers',
        current: downloaded,
        total: items.length,
        message: `Downloading sticker ${downloaded}/${items.length}`,
      });
    }
  }

  /**
   * Download guild role icons
   */
  private async downloadRoleIcons(
    guild: Guild,
    entityName: string,
    zipService: StreamingZipService,
    onProgress: (progress: MediaDownloadProgress) => void,
    shouldContinue?: ShouldContinueFn
  ): Promise<void> {
    const roles = guild.roles?.filter((r) => r.icon) || [];

    // Report progress even if there are no role icons
    if (roles.length === 0) {
      onProgress({
        stage: 'roles',
        current: 0,
        total: 0,
        message: 'No role icons to download',
      });
      return;
    }

    let downloaded = 0;

    for (const role of roles) {
      if (shouldContinue) await shouldContinue();
      // Canonical key shape (#171): match what the HTML emitters render
      // live so the templates can do a direct roleMap[cdnUrl] lookup
      // without normalization. Discord's CDN serves both .webp?size=20
      // and the .png variants; we read whichever Discord returns and
      // store under the canonical key.
      const cdnUrl = `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.webp?size=20`;

      if (!this.maps.roleMap[cdnUrl]) {
        const blob = await this.downloadWithTimeout(cdnUrl);
        if (blob) {
          const ext = this.getFileExtension(blob) || 'webp';
          const fileName = filenamify(`${role.name}_${role.id}.${ext}`, { replacement: '_' });
          const filePath = `${entityName}/roles/${fileName}`;
          await zipService.addFile(blob, filePath);
          this.maps.roleMap[cdnUrl] = filePath;
        } else {
          console.warn(`Failed to download role icon: ${cdnUrl}`);
        }
      }

      downloaded++;
      onProgress({
        stage: 'roles',
        current: downloaded,
        total: roles.length,
        message: `Downloading role icon ${downloaded}/${roles.length}`,
      });
    }
  }

  /**
   * Detect file extension from MIME type
   */
  private getFileExtension(blob: Blob): string | null {
    const mimeMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
    };

    return mimeMap[blob.type] || null;
  }

  /**
   * Extract extension from filename
   */
  private getExtensionFromFilename(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'bin';
  }

  /**
   * Get the media maps
   */
  getMaps(): MediaMaps {
    return this.maps;
  }
}
