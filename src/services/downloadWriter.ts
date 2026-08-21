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
 * iOS experiment (Option A): the same service-worker stream drip-fs uses,
 * but the download URL is opened in a NEW TAB instead of a hidden iframe.
 * iOS forbids iframe downloads (it promotes them to a tab navigation that
 * unloads the app); a top-level navigation to the attachment response
 * should land in the WebKit download manager while this tab keeps
 * streaming. Speaks drip-fs's SW protocol directly so no lib release is
 * needed for the trial. Returns null when the popup is blocked or no SW
 * controls the page, so the caller can fall back to the Blob writer.
 */
export const createTabStreamWriter = async (
  filename: string,
  onProgress?: (bytes: number) => void,
): Promise<StreamDownloadWriter | null> => {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return null;
  const channel = new MessageChannel();
  const port = channel.port1;
  controller.postMessage({ filename }, [channel.port2]);
  let url: string;
  try {
    url = await new Promise<string>((resolve, reject) => {
      port.onmessage = (event: MessageEvent) => {
        if (event.data?.download) resolve(event.data.download as string);
        else if (event.data?.error) reject(new Error(String(event.data.error)));
      };
      setTimeout(() => reject(new Error('Failed to get download URL from service worker')), 5000);
    });
  } catch {
    port.close();
    return null;
  }
  const tab = window.open(url, '_blank');
  if (!tab) {
    // Popup blocked (the export finishes long after the tap): tell the SW
    // to drop the pending stream and let the caller fall back.
    port.postMessage('abort');
    port.close();
    return null;
  }
  let bytesWritten = 0;
  let closed = false;
  return {
    async write(chunk: Uint8Array) {
      if (closed) throw new Error('Cannot write to closed stream');
      port.postMessage(chunk);
      bytesWritten += chunk.byteLength;
      onProgress?.(bytesWritten);
    },
    async close() {
      if (closed) return;
      closed = true;
      port.postMessage('end');
      port.close();
    },
    async abort() {
      if (closed) return;
      closed = true;
      port.postMessage('abort');
      port.close();
    },
    get bytesWritten() {
      return bytesWritten;
    },
  } as StreamDownloadWriter;
};

/**
 * drip-fs streaming everywhere except iOS WebKit (Safari AND Chrome/Firefox
 * on iPhone, which are WebKit too), which tries the new-tab stream first and
 * falls back to the buffered Blob writer.
 */
export const createDownloadWriter = async (filename: string): Promise<StreamDownloadWriter> => {
  if (!isIOSSafari()) return createStreamingDownload(filename);
  return (await createTabStreamWriter(filename)) ?? createBlobDownloadWriter(filename);
};
