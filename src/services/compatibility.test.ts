import { describe, it, expect } from 'vitest';
import {
  COMPAT_ROWS,
  COMPAT_SETUPS,
  COMPAT_TABLE,
  compatSetupLabel,
  detectCompatSetup,
  isFirefoxUA,
  isPhoneUA,
  usesSmallZipParts,
} from './compatibility';

const nav = (userAgent: string, extra: Partial<Navigator> = {}) =>
  ({ userAgent, platform: 'Win32', maxTouchPoints: 0, ...extra }) as Navigator;

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';

describe('compatibility', () => {
  it('detects the extension columns by engine', () => {
    expect(detectCompatSetup(nav(CHROME), true)).toBe('chrome-ext');
    expect(detectCompatSetup(nav(FIREFOX), true)).toBe('firefox-ext');
  });

  it('detects the Bleeding Edge columns outside the extension', () => {
    expect(detectCompatSetup(nav(CHROME), false)).toBe('be-chrome');
    expect(detectCompatSetup(nav(FIREFOX), false)).toBe('be-firefox');
    expect(detectCompatSetup(nav(IPHONE), false)).toBe('be-phone');
    expect(detectCompatSetup(nav(ANDROID), false)).toBe('be-phone');
  });

  it('treats iPadOS desktop UA with touch as a phone', () => {
    const ipad = nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', {
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(isPhoneUA(ipad)).toBe(true);
    expect(detectCompatSetup(ipad, false)).toBe('be-phone');
  });

  it('Firefox detection ignores Chrome and Safari', () => {
    expect(isFirefoxUA(nav(FIREFOX))).toBe(true);
    expect(isFirefoxUA(nav(CHROME))).toBe(false);
    expect(isFirefoxUA(nav(IPHONE))).toBe(false);
  });

  it('has a cell for every setup and row, with a label per setup', () => {
    for (const s of COMPAT_SETUPS) {
      expect(compatSetupLabel(s.key)).toBe(s.label);
      for (const r of COMPAT_ROWS) {
        const cell = COMPAT_TABLE[s.key][r.key];
        expect(cell.text.length).toBeGreaterThan(0);
        expect(['ok', 'note']).toContain(cell.status);
      }
    }
  });

  it('matches the ratified matrix', () => {
    expect(COMPAT_TABLE['chrome-ext'].exportSize.status).toBe('ok');
    expect(COMPAT_TABLE['firefox-ext'].exportSize.text).toBe('Smaller parts');
    expect(COMPAT_TABLE['be-firefox'].exportSize.status).toBe('ok');
    expect(COMPAT_TABLE['be-phone'].exportSize.text).toBe('Smaller parts');
    for (const be of ['be-chrome', 'be-firefox', 'be-phone'] as const) {
      expect(COMPAT_TABLE[be].signIn.text).toBe('Manual');
      expect(COMPAT_TABLE[be].exportMedia.text).toBe('Most files');
    }
    expect(COMPAT_TABLE['chrome-ext'].signIn.text).toBe('Automatic');
    expect(COMPAT_TABLE['firefox-ext'].exportMedia.text).toBe('All files');
  });

  it('only the buffered-writer setups get small zip parts', () => {
    expect(usesSmallZipParts('firefox-ext')).toBe(true);
    expect(usesSmallZipParts('be-phone')).toBe(true);
    expect(usesSmallZipParts('chrome-ext')).toBe(false);
    expect(usesSmallZipParts('be-chrome')).toBe(false);
    expect(usesSmallZipParts('be-firefox')).toBe(false);
  });
});
