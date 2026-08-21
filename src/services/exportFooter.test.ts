import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_FOOTER_TEXT,
  FOOTER_TEXT_MAX_LENGTH,
  resolveExportFooterConfig,
  defaultExportFooterConfig,
  buildExportFooterHtml,
  processFooterIconFile,
} from './exportFooter';

const ICON = 'data:image/png;base64,abc123';

describe('exportFooter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('resolveExportFooterConfig', () => {
    it('gives non-supporters the fixed default regardless of stored preferences', () => {
      const config = resolveExportFooterConfig({
        isSupporter: false,
        preferences: { text: 'My archive', removed: true, iconDataUri: ICON },
        defaultIconDataUri: 'data:image/png;base64,default',
      });
      expect(config).toEqual({
        removed: false,
        text: DEFAULT_FOOTER_TEXT,
        iconDataUri: 'data:image/png;base64,default',
      });
    });

    it('honors supporter custom text and icon', () => {
      const config = resolveExportFooterConfig({
        isSupporter: true,
        preferences: { text: '  My archive  ', removed: false, iconDataUri: ICON },
        defaultIconDataUri: null,
      });
      expect(config).toEqual({ removed: false, text: 'My archive', iconDataUri: ICON });
    });

    it('honors supporter removal', () => {
      const config = resolveExportFooterConfig({
        isSupporter: true,
        preferences: { text: 'ignored', removed: true, iconDataUri: ICON },
        defaultIconDataUri: null,
      });
      expect(config.removed).toBe(true);
    });

    it('falls back to default text and icon for blank supporter values', () => {
      const config = resolveExportFooterConfig({
        isSupporter: true,
        preferences: { text: '   ', removed: false, iconDataUri: null },
        defaultIconDataUri: 'data:image/png;base64,default',
      });
      expect(config.text).toBe(DEFAULT_FOOTER_TEXT);
      expect(config.iconDataUri).toBe('data:image/png;base64,default');
    });

    it('clamps overlong custom text', () => {
      const config = resolveExportFooterConfig({
        isSupporter: true,
        preferences: { text: 'x'.repeat(500), removed: false, iconDataUri: null },
        defaultIconDataUri: null,
      });
      expect(config.text).toHaveLength(FOOTER_TEXT_MAX_LENGTH);
    });
  });

  describe('buildExportFooterHtml', () => {
    const meta = { dateText: 'August 21, 2026', metaLine: 'html · 5 messages' };

    it('renders the default line with the accent emphasis', () => {
      const html = buildExportFooterHtml(defaultExportFooterConfig(), meta);
      expect(html).toContain('Exported with <strong>Discrub</strong> on August 21, 2026');
      expect(html).toContain('html · 5 messages');
      expect(html).not.toContain('export-footer-icon');
    });

    it('renders the icon when present', () => {
      const html = buildExportFooterHtml(
        { removed: false, text: DEFAULT_FOOTER_TEXT, iconDataUri: ICON },
        meta,
      );
      expect(html).toContain(`src="${ICON}"`);
      expect(html).toContain('class="export-footer-icon"');
    });

    it('escapes custom text so exports cannot be script-injected', () => {
      const html = buildExportFooterHtml(
        { removed: false, text: '<script>alert(1)</script> & "friends"', iconDataUri: null },
        meta,
      );
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;friends&quot;');
    });

    it('returns an empty string when removed', () => {
      expect(
        buildExportFooterHtml({ removed: true, text: '', iconDataUri: null }, meta),
      ).toBe('');
    });
  });

  describe('processFooterIconFile', () => {
    it('rejects SVG uploads (script surface in exports)', async () => {
      const file = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });
      await expect(processFooterIconFile(file)).rejects.toThrow(/PNG, JPEG, or WebP/);
    });

    it('rejects oversized uploads before decoding', async () => {
      const file = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', {
        type: 'image/png',
      });
      await expect(processFooterIconFile(file)).rejects.toThrow(/under 5MB/);
    });

    it('rejects a file that does not decode as an image', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad')));
      const file = new File(['not an image'], 'fake.png', { type: 'image/png' });
      await expect(processFooterIconFile(file)).rejects.toThrow(/couldn't be read/);
    });
  });
});
