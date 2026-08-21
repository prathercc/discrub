import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestSupporterKey, SupporterClaimError } from './supporterClaimService';

describe('supporterClaimService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const okResult = {
    key: 'DSCRB-abc.def',
    tier: 'monthly',
    name: 'Aaron P.',
    expiresAt: '2026-09-30T00:00:00.000Z',
  };

  it('POSTs the email to the claim endpoint and returns the result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okResult,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await requestSupporterKey('user@example.com');

    expect(result).toEqual(okResult);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.pratherbytecraft.com/supporter/claim',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });

  it('includes a trimmed display name only when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okResult,
    });
    vi.stubGlobal('fetch', mockFetch);

    await requestSupporterKey('user@example.com', '  Aaron P.  ');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      email: 'user@example.com',
      displayName: 'Aaron P.',
    });

    await requestSupporterKey('user@example.com', '   ');
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
      email: 'user@example.com',
    });
  });

  it("surfaces the server's user-facing error message", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        status: 404,
        error: 'No active supporter membership was found for that email',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(requestSupporterKey('user@example.com')).rejects.toMatchObject({
      name: 'SupporterClaimError',
      message: 'No active supporter membership was found for that email',
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

    await expect(requestSupporterKey('user@example.com')).rejects.toBeInstanceOf(
      SupporterClaimError,
    );
  });

  it('wraps network failures in a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(requestSupporterKey('user@example.com')).rejects.toMatchObject({
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

    await expect(requestSupporterKey('user@example.com')).rejects.toBeInstanceOf(
      SupporterClaimError,
    );
  });
});
