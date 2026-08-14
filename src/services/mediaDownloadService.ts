import { getDiscordService } from '@services/discordService';
import { wait } from 'discrub-core/common-utils';
import { EmbedType } from 'discrub-core/discord-enum';
import filenamify from 'filenamify';
import { isExtensionMode } from '@/extension/messaging';
import { addStatusEntry } from '@features/status/statusSlice';
import type { Message, Guild } from 'discrub-core/types/discord-types';
import type { ExportReactionMap } from 'discrub-core/types/discrub-types';
import type { MediaDownloadProgress, MediaMaps, MediaConfig } from '@features/export/exportTypes';
import type { StreamingZipService } from './streamingZipService';
import { IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS } from '@/constants/mediaExtensions';

export type ShouldContinueFn = () => Promise<void>;

/** Transport result — matches discrub-core's DiscordApiResponse<Blob> shape. */
export type MediaDownloadResult = { success: boolean; data: Blob | null; status?: number };
export type MediaTransport = (url: string) => Promise<MediaDownloadResult>;
export type MediaWarnFn = (message: string) => void;

/**
 * #234 default WARN sink: the status log. Lazy store import mirrors
 * discordService's onRateLimit wiring (store → slices → services → store).
 */
const dispatchStatusWarning: MediaWarnFn = (message) => {
  void import('@/app/store').then(({ store }) => {
    store.dispatch(addStatusEntry({ level: 'warning', message }));
  });
};

/**
 * #232: window of NO byte progress after which a download is abandoned.
 * A stall window (rather than a total-time cap) means a slow connection
 * that is still receiving data never gets cut off, no matter how large
 * the attachment — Discord allows 500MB, which a flat cap structurally
 * fails on slow links — while a dead link still fails fast.
 */
const STALL_TIMEOUT_MS = 30_000;

/** Bounded 429 retries — parity with the lib transport's rate-limit loop. */
const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * #232 default media transport: streaming fetch with a stall-based abort.
 *
 * Replaces `discordService.downloadFile` (a buffered fetch raced against a
 * flat 10s timer that never aborted the losing fetch — GitHub #12). Parity
 * is preserved with the lib transport it replaces:
 * - jittered searchDelay pacing before each fetch (the lib's
 *   `withDelay('search')`), read off the live DiscordService instance
 * - bounded 429 handling honoring Retry-After, surfaced via `onRateLimit`
 * - resolves to the same `{ success, data }` shape
 */
export async function streamDownloadWithStallGuard(url: string): Promise<MediaDownloadResult> {
  const discordService = getDiscordService();

  const baseDelay = discordService.searchDelaySecs;
  if (baseDelay > 0) {
    const min = Math.max(baseDelay - discordService.delayModifierSecs, 0);
    const max = baseDelay + discordService.delayModifierSecs;
    await wait(discordService.calculateRandomNumber(max, min));
  }

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
    };

    try {
      armStallTimer();
      const response = await fetch(url, { signal: controller.signal });

      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfterSecs = Number(response.headers.get('retry-after')) || 1;
        discordService.onRateLimit?.(retryAfterSecs);
        clearTimeout(stallTimer);
        await wait(retryAfterSecs);
        continue;
      }

      if (!response.ok) {
        return { success: false, data: null, status: response.status };
      }

      if (!response.body) {
        // Environment without body streaming — buffered fallback (no
        // mid-body stall detection, but the initial-response timer above
        // still bounds a dead connection).
        const blob = await response.blob();
        return { success: true, data: blob, status: response.status };
      }

      armStallTimer();
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        armStallTimer(); // any byte progress resets the stall clock
      }
      const type = response.headers.get('content-type') || '';
      return {
        success: true,
        data: new Blob(chunks, type ? { type } : undefined),
        status: response.status,
      };
    } catch {
      // Includes the stall abort — caller falls back to an external link
      return { success: false, data: null };
    } finally {
      clearTimeout(stallTimer);
    }
  }
}

/**
 * MediaDownloadService - Orchestrates media downloads with progress tracking
 * Downloads avatars, attachments, emojis, and role icons for offline export
 */
export class MediaDownloadService {
  /**
   * Transport seam (#232): production uses the stall-guard streaming
   * fetch; unit tests inject a stub with the same response shape.
   */
  private transport?: MediaTransport;

  /**
   * WARN seam (#234): production dispatches to the status log; unit tests
   * inject a stub so no store is pulled into the test environment.
   */
  private warn: MediaWarnFn;

  constructor(transport?: MediaTransport, warn?: MediaWarnFn) {
    this.transport = transport;
    this.warn = warn ?? dispatchStatusWarning;
  }

  private maps: MediaMaps = {
    avatarMap: {},
    mediaMap: {},
    emojiMap: {},
    roleMap: {},
  };

  /**
   * Per-instance sequence appended to attachment/embed filenames. Two
   * attachments on the same message download within the same millisecond,
   * so `${messageIndex}_${Date.now()}` alone can collide — which used to
   * kill the whole export at the zip writer (#224).
   */
  private mediaFileSeq = 0;

  /**
   * Single download attempt through the transport, preserving the HTTP
   * status of a failure so callers can diagnose it (#234). A thrown
   * network/CORS error collapses to `{ success: false }` with no status.
   */
  private async downloadAttempt(url: string): Promise<MediaDownloadResult> {
    try {
      const transport = this.transport ?? streamDownloadWithStallGuard;
      return await transport(url);
    } catch {
      return { success: false, data: null };
    }
  }

  /**
   * Download a file, returning the blob or null on failure. Failure is a
   * stall (no bytes for STALL_TIMEOUT_MS), an HTTP error, or a network
   * error — never mere slowness (#232).
   */
  private async downloadWithTimeout(url: string): Promise<Blob | null> {
    const result = await this.downloadAttempt(url);
    return result.success && result.data ? result.data : null;
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
          // Record the path the zip actually stored — addFile renames on
          // collision (#224), and the map must point at the real entry.
          this.maps.avatarMap[idAndAvatar] = await zipService.addFile(blob, filePath);
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
      fallbackUrl?: string;
      messageIndex: number;
      filename: string;
      type: 'attachment' | 'embed-image' | 'embed-video' | 'embed-thumbnail';
      authorName: string;
      timestamp?: string;
    }> = [];

    const useProxyUrl = !isExtensionMode();

    // #234: every media item keeps BOTH its URLs. Web mode leads with the
    // proxy (the direct cdn.discordapp.com URL is CORS-dead there) but the
    // proxy 415s some formats (webp); extension mode leads with the direct
    // URL but external-CDN embeds can be unreachable while the Discord-proxy
    // copy IS fetchable under the extension's discordapp.net host
    // permissions. Either way the other distinct URL is the second leg.
    const resolveLegs = (url: string, proxyUrl?: string) => {
      const downloadUrl = useProxyUrl && proxyUrl ? proxyUrl : url;
      const other = downloadUrl === url ? proxyUrl : url;
      return { downloadUrl, fallbackUrl: other && other !== downloadUrl ? other : undefined };
    };

    // Collect attachment + embed media from a single message-like source.
    // Used for the top-level message AND for each forwarded snapshot's
    // payload (#214) so forwarded attachments/embedded images are downloaded
    // and URL-rewritten exactly like top-level media.
    const collectMedia = (
      source: Pick<Message, 'attachments' | 'embeds'> | Partial<Message> | null | undefined,
      authorName: string,
      index: number,
      timestamp?: string
    ) => {
      if (!source) return;
      const attachments = source.attachments || [];
      attachments.forEach((att) => {
        if (att.url && this.shouldDownloadFile(att.filename || 'unknown', mediaConfig)) {
          attachmentUrls.push({
            url: att.url,
            ...resolveLegs(att.url, att.proxy_url),
            messageIndex: index,
            filename: att.filename || 'unknown',
            type: 'attachment',
            authorName,
            timestamp,
          });
        }
      });

      // Also get media from embeds
      const embeds = source.embeds || [];
      embeds.forEach((embed) => {
        if (embed.image?.url) {
          attachmentUrls.push({
            url: embed.image.url,
            ...resolveLegs(embed.image.url, embed.image.proxy_url),
            messageIndex: index,
            filename: 'embed_image',
            type: 'embed-image',
            authorName,
            timestamp,
          });
        }
        if (embed.video?.url) {
          attachmentUrls.push({
            url: embed.video.url,
            ...resolveLegs(embed.video.url, embed.video.proxy_url),
            messageIndex: index,
            filename: 'embed_video',
            type: 'embed-video',
            authorName,
            timestamp,
          });
        }
        // #219 residue: a gifv embed (Tenor/Giphy) renders as its video —
        // the thumbnail .gif is never referenced by the HTML, so
        // downloading it just plants a dead file in the zip. Skip it
        // whenever the gifv's video is being downloaded instead.
        const isGifvWithVideo = embed.type === EmbedType.GIFV && !!embed.video?.url;
        if (embed.thumbnail?.url && !isGifvWithVideo) {
          attachmentUrls.push({
            url: embed.thumbnail.url,
            ...resolveLegs(embed.thumbnail.url, embed.thumbnail.proxy_url),
            messageIndex: index,
            filename: 'embed_thumbnail',
            type: 'embed-thumbnail',
            authorName,
            timestamp,
          });
        }
      });
    };

    messages.forEach((msg, index) => {
      const authorName = msg.author?.username || 'unknown';
      collectMedia(msg, authorName, index, msg.timestamp);

      // #214: forwarded messages (message_reference.type === 1) carry their
      // real payload — including attachments and embedded media — inside
      // message_snapshots[].message, NOT on the top-level message. Without
      // this pass that media is rendered in the feed/HTML but never downloaded,
      // leaving dead CDN links offline. Only snapshot[0] is collected: both the
      // feed and the HTML emitter render only message_snapshots[0], so deeper
      // snapshots would download orphaned files that are never linked.
      collectMedia(msg.message_snapshots?.[0]?.message, authorName, index, msg.timestamp);
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

    for (const { url, downloadUrl, fallbackUrl, messageIndex, filename, type, authorName, timestamp } of attachmentUrls) {
      if (shouldContinue) await shouldContinue();
      if (!this.maps.mediaMap[url]) {
        // Try the preferred leg first, then the other distinct URL (#234) —
        // Discord's media proxy reliably serves images but 415s some formats
        // (webp) and has historically been flaky for external video CDNs
        // (Tenor mp4s in particular), while the direct URL's CORS
        // characteristics cut the other way. Both legs run through the same
        // transport, so pacing and 429 handling apply to each attempt.
        const attempts: Array<{ attemptedUrl: string; result: MediaDownloadResult }> = [];
        let blob: Blob | null = null;
        for (const attemptUrl of fallbackUrl ? [downloadUrl, fallbackUrl] : [downloadUrl]) {
          const result = await this.downloadAttempt(attemptUrl);
          attempts.push({ attemptedUrl: attemptUrl, result });
          if (result.success && result.data) {
            blob = result.data;
            break;
          }
        }
        if (blob) {
          const ext = this.getFileExtension(blob) || this.getExtensionFromFilename(filename);
          const sanitizedFilename = filenamify(`${messageIndex}_${Date.now()}_${this.mediaFileSeq++}.${ext}`, {
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

          // #235: message-derived media carries the source message's
          // timestamp as its zip modified date (1.x parity).
          const storedPath = await zipService.addFile(
            blob,
            filePath,
            timestamp ? new Date(timestamp) : undefined,
          );
          // Re-derive the relative path from the stored path in case the
          // zip renamed a colliding entry (#224); renames only touch the
          // basename, so stripping the entity prefix stays valid.
          this.maps.mediaMap[url] = storedPath.startsWith(`${entityName}/`)
            ? storedPath.slice(entityName.length + 1)
            : relativePath;
        } else {
          // #234: surface per-leg failure detail in the status log — the
          // proxy leg is any attempt at proxy_url, the direct leg the
          // original url; a missing status means the fetch itself threw
          // (CORS, network, or a stall abort).
          const detail = attempts
            .map(({ attemptedUrl, result }) =>
              `${attemptedUrl === url ? 'direct' : 'proxy'} ${result.status ?? 'CORS/network'}`)
            .join(', ');
          this.warn(`Export: Could not download ${filename} — ${detail}`);
          console.warn(
            `[mediaDownloadService] Failed to download ${type}`,
            { original: url, attempted: attempts.map((a) => a.attemptedUrl), detail },
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
          this.maps.emojiMap[emojiId] = await zipService.addFile(blob, filePath);
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
          this.maps.roleMap[cdnUrl] = await zipService.addFile(blob, filePath);
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
