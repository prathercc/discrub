import { createStreamingDownload } from 'drip-fs';
import type { StreamDownloadWriter } from 'drip-fs';

/**
 * iOS Safari (iPhone, iPad, and iPadOS reporting as "MacIntel" with touch)
 * cannot take the drip-fs service-worker stream: it navigates the tab to
 * the hidden-iframe download URL, which unloads the app and, with a
 * memory-only token, lands on the sign-in screen. Those browsers get a
 * buffered Blob + `<a download>` instead (share sheet, page stays put).
 */
export const isIOSSafari = (nav: Navigator = navigator): boolean => {
  const ua = nav.userAgent || '';
  const applePhone = /iP(hone|ad|od)/.test(ua);
  const iPadOSDesktopUA = nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
  return applePhone || iPadOSDesktopUA;
};

/** Buffered writer with the drip-fs `StreamDownloadWriter` shape. */
export const createBlobDownloadWriter = (
  filename: string,
  onProgress?: (bytes: number) => void,
): StreamDownloadWriter => {
  const chunks: Uint8Array[] = [];
  let bytesWritten = 0;
  let closed = false;
  return {
    async write(chunk: Uint8Array) {
      if (closed) throw new Error('Cannot write to closed stream');
      chunks.push(chunk);
      bytesWritten += chunk.byteLength;
      onProgress?.(bytesWritten);
    },
    async close() {
      if (closed) return;
      closed = true;
      const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' });
      chunks.length = 0;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    },
    async abort() {
      closed = true;
      chunks.length = 0;
    },
    get bytesWritten() {
      return bytesWritten;
    },
  } as StreamDownloadWriter;
};

/**
 * drip-fs 1.1 picks the path itself (service-worker stream, or an
 * OPFS-staged file on iOS WebKit where iframe downloads are forbidden).
 * The in-memory Blob writer stays as the last resort for iOS devices
 * where drip-fs cannot open the staged file (old WebKit without OPFS
 * sync access handles, or a storage-quota refusal).
 */
export const createDownloadWriter = async (filename: string): Promise<StreamDownloadWriter> => {
  try {
    return await createStreamingDownload(filename);
  } catch (err) {
    if (!isIOSSafari()) throw err;
    console.warn('drip-fs could not stage the download on this device; buffering in memory instead.', err);
    return createBlobDownloadWriter(filename);
  }
};
