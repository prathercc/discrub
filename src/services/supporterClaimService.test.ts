import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeSupporterCode,
  requestSupporterKeyRedemption,
  requestSupporterKeyRefresh,
  SupporterClaimError,
} from './supporterClaimService';

describe('supporterClaimService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const okResult = {
    key: 'DSCRB-abc.def',
    ent: { themes: 1790000000 },
    name: 'Aaron P.',
    expiresAt: '2026-09-30T00:00:00.000Z',
  };

  it('POSTs the key to the refresh endpoint and returns the result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okResult,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await requestSupporterKeyRefresh('DSCRB-old.key');

    expect(result).toEqual(okResult);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.pratherbytecraft.com/supporter/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'DSCRB-old.key' }),
      }),
    );
  });

  it("surfaces the server's user-facing error message", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        status: 404,
        error: 'That key does not match an active supporter membership',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(requestSupporterKeyRefresh('DSCRB-old.key')).rejects.toMatchObject({
      name: 'SupporterClaimError',
      message: 'That key does not match an active supporter membership',
      status: 404,
    });
  });

  it('falls back to a generic message on a non-JSON error body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(requestSupporterKeyRefresh('DSCRB-old.key')).rejects.toBeInstanceOf(
      SupporterClaimError,
    );
  });

  it('wraps network failures in a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(requestSupporterKeyRefresh('DSCRB-old.key')).rejects.toMatchObject({
      name: 'SupporterClaimError',
      status: null,
    });
  });

  it('rejects a malformed success payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nope: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(requestSupporterKeyRefresh('DSCRB-old.key')).rejects.toBeInstanceOf(
      SupporterClaimError,
    );
  });
});

describe('normalizeSupporterCode', () => {
  it('accepts the canonical shape and normalizes case/spaces', () => {
    expect(normalizeSupporterCode('DSCRB-AAAA-2222')).toBe('DSCRB-AAAA-2222');
    expect(normalizeSupporterCode('  dscrb aaaa 2222  ')).toBe('DSCRB-AAAA-2222');
  });

  it('rejects full keys and other input', () => {
    expect(normalizeSupporterCode('DSCRB-eyJhbGci.signature')).toBeNull();
    expect(normalizeSupporterCode('DSCRB-AAAA-22')).toBeNull();
    expect(normalizeSupporterCode('hello there')).toBeNull();
    expect(normalizeSupporterCode('')).toBeNull();
  });
});

describe('requestSupporterKeyRedemption', () => {
  it('posts the code to the redeem endpoint and returns the result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        key: 'DSCRB-full.key',
        ent: { themes: null },
        name: 'Aaron P.',
        expiresAt: null,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await requestSupporterKeyRedemption('DSCRB-AAAA-2222');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.pratherbytecraft.com/supporter/redeem',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'DSCRB-AAAA-2222' }),
      }),
    );
    expect(result.key).toBe('DSCRB-full.key');
  });

  it('surfaces the server error body as a SupporterClaimError', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: 'That code does not match an active supporter key',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      requestSupporterKeyRedemption('DSCRB-AAAA-2222'),
    ).rejects.toMatchObject({
      name: 'SupporterClaimError',
      message: 'That code does not match an active supporter key',
      status: 404,
    });
  });

  it('wraps a network failure in the fallback message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(
      requestSupporterKeyRedemption('DSCRB-AAAA-2222'),
    ).rejects.toMatchObject({ name: 'SupporterClaimError', status: null });
  });

  it('rejects a malformed success body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ent: { themes: null } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      requestSupporterKeyRedemption('DSCRB-AAAA-2222'),
    ).rejects.toMatchObject({ name: 'SupporterClaimError' });
  });
});
