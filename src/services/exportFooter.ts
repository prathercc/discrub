/**
 * Export footer (v2.1.0 slot F).
 *
 * Every HTML export page carries a one-line "Exported with Discrub"
 * footer with the app logo — the discovery engine. Supporters can
 * change the text, upload their own small icon, or remove the footer
 * entirely; those preferences only apply while a valid supporter key
 * is present at export time (stored values survive a lapse and come
 * back with a re-claim).
 *
 * The "Made with Framer" bar: if a reasonable user would call it a
 * watermark, it's too loud.
 */

export interface ExportFooterConfig {
  /** True removes the footer block entirely (supporter-only). */
  removed: boolean;
  /** Branding line text (plain text, escaped at render). */
  text: string;
  /** Small icon rendered before the text, as a data URI. */
  iconDataUri: string | null;
}

export const DEFAULT_FOOTER_TEXT = 'Exported with Discrub';

/** Longest accepted custom footer text (UI enforces, render clamps). */
export const FOOTER_TEXT_MAX_LENGTH = 80;

/** Rendered icon box in the footer (CSS pixels). */
export const FOOTER_ICON_SIZE = 32;

/** Accepted upload types — raster only; SVG is a script surface. */
export const FOOTER_ICON_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Reject absurd uploads before decode (downscaling handles the rest). */
export const FOOTER_ICON_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Cap on the stored data URI after downscale (~32px PNGs are ~1-4KB). */
export const FOOTER_ICON_MAX_DATA_URI_LENGTH = 64 * 1024;

/**
 * The free-tier footer icon: the bundled 48px app icon, fetched once
 * and cached as a data URI. Fail-soft — an environment where the fetch
 * or FileReader is unavailable (unit tests) just renders no icon.
 */
let defaultIconPromise: Promise<string | null> | null = null;

export function getDefaultFooterIconDataUri(): Promise<string | null> {
  if (!defaultIconPromise) {
    defaultIconPromise = (async () => {
      try {
        const response = await fetch('/icons/icon-48.png');
        if (!response.ok) return null;
        const blob = await response.blob();
        return await blobToDataUri(blob);
      } catch {
        return null;
      }
    })();
  }
  return defaultIconPromise;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface SupporterFooterPreferences {
  text: string | null;
  removed: boolean;
  iconDataUri: string | null;
}

/**
 * Resolve the footer an export should carry. Free exports always get
 * the fixed default; supporter preferences apply only with a valid key
 * right now.
 */
export function resolveExportFooterConfig(options: {
  isSupporter: boolean;
  preferences?: SupporterFooterPreferences | null;
  defaultIconDataUri: string | null;
}): ExportFooterConfig {
  const { isSupporter, preferences, defaultIconDataUri } = options;
  if (!isSupporter || !preferences) {
    return { removed: false, text: DEFAULT_FOOTER_TEXT, iconDataUri: defaultIconDataUri };
  }
  if (preferences.removed) {
    return { removed: true, text: '', iconDataUri: null };
  }
  const text = preferences.text?.trim()
    ? preferences.text.trim().slice(0, FOOTER_TEXT_MAX_LENGTH)
    : DEFAULT_FOOTER_TEXT;
  return {
    removed: false,
    text,
    iconDataUri: preferences.iconDataUri ?? defaultIconDataUri,
  };
}

/** The pre-customization behavior: default text, whatever icon loaded. */
export function defaultExportFooterConfig(): ExportFooterConfig {
  return { removed: false, text: DEFAULT_FOOTER_TEXT, iconDataUri: null };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render the footer block for an export page. `metaLine` (format,
 * message count, page info) is informational and rides along whenever
 * the footer itself is present. Returns '' when removed.
 */
export function buildExportFooterHtml(
  config: ExportFooterConfig,
  options: { dateText: string; metaLine: string },
): string {
  if (config.removed) return '';
  const icon = config.iconDataUri
    ? `<img class="export-footer-icon" src="${config.iconDataUri}" alt="" width="${FOOTER_ICON_SIZE}" height="${FOOTER_ICON_SIZE}">`
    : '';
  const isDefaultText = config.text === DEFAULT_FOOTER_TEXT;
  // The default line keeps its long-standing "Exported with
  // <strong>Discrub</strong>" emphasis; custom text renders plain.
  const textHtml = isDefaultText
    ? 'Exported with <strong>Discrub</strong>'
    : escapeHtml(config.text);
  return `
  <footer class="export-footer">${icon ? `
    ${icon}` : ''}
    <div class="export-footer-lines">
      <div class="export-footer-text">${textHtml} on ${options.dateText}</div>
      <div class="export-footer-meta">${options.metaLine}</div>
    </div>
  </footer>`;
}

/**
 * Validate + downscale an uploaded footer icon to a small square data
 * URI. Raster formats only (no SVG — script-injection surface in
 * exports). Throws Error with a user-facing message on rejection.
 */
export async function processFooterIconFile(file: File): Promise<string> {
  if (!FOOTER_ICON_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  if (file.size > FOOTER_ICON_MAX_UPLOAD_BYTES) {
    throw new Error('That image is too large. Choose one under 5MB.');
  }

  const targetSize = FOOTER_ICON_SIZE * 2; // 2x for crisp HiDPI rendering
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file couldn't be read as an image.");
  });
  try {
    const scale = Math.min(1, targetSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("That file couldn't be read as an image.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const dataUri = canvas.toDataURL('image/png');
    if (dataUri.length > FOOTER_ICON_MAX_DATA_URI_LENGTH) {
      throw new Error('That image is too complex for a footer icon. Try a simpler one.');
    }
    return dataUri;
  } finally {
    bitmap.close?.();
  }
}
