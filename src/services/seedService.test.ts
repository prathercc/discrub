import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  postMessage,
  addSelfReaction,
  editMessageContent,
  pinMessage,
} from './seedService';

const TOKEN = 'tok-test';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok<T>(status: number, json?: T): Response {
  return {
    ok: true,
    status,
    json: async () => json as T,
  } as unknown as Response;
}
function fail(status: number, message?: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({ message: message ?? 'err' }),
  } as unknown as Response;
}

describe('postMessage', () => {
  it('posts JSON body and returns parsed message on 200', async () => {
    (fetch as any).mockResolvedValueOnce(ok(200, { id: 'm1', channel_id: 'c1', content: 'hi' }));
    const res = await postMessage(TOKEN, 'c1', { content: 'hi' });
    expect(res.ok).toBe(true);
    expect(res.data?.id).toBe('m1');
    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toContain('/channels/c1/messages');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers.authorization).toBe(TOKEN);
  });

  it('serializes message_reference for replies', async () => {
    (fetch as any).mockResolvedValueOnce(ok(200, { id: 'r1', channel_id: 'c1', content: 'hi' }));
    await postMessage(TOKEN, 'c1', {
      content: 'reply',
      message_reference: { message_id: 'parent', channel_id: 'c1', fail_if_not_exists: false },
    });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.message_reference.message_id).toBe('parent');
  });

  it('returns ok: false with status + error on non-2xx', async () => {
    (fetch as any).mockResolvedValueOnce(fail(403, 'Missing Permissions'));
    const res = await postMessage(TOKEN, 'c1', { content: 'no' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.error).toBe('Missing Permissions');
  });

  it('handles network errors without throwing', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('offline'));
    const res = await postMessage(TOKEN, 'c1', { content: 'x' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toBe('offline');
  });
});

describe('addSelfReaction', () => {
  it('PUTs to the encoded emoji endpoint', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    await addSelfReaction(TOKEN, 'c1', 'm1', '👍');
    const url = (fetch as any).mock.calls[0][0];
    expect(url).toContain('/channels/c1/messages/m1/reactions/');
    expect(url).toContain('@me');
    expect(url).toContain(encodeURIComponent('👍'));
  });
});

describe('editMessageContent', () => {
  it('PATCHes with new content', async () => {
    (fetch as any).mockResolvedValueOnce(ok(200, { id: 'm1', channel_id: 'c1', content: 'new' }));
    await editMessageContent(TOKEN, 'c1', 'm1', 'new');
    const init = (fetch as any).mock.calls[0][1];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body).content).toBe('new');
  });
});

describe('pinMessage', () => {
  it('PUTs to the pins endpoint', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    await pinMessage(TOKEN, 'c1', 'm1');
    expect((fetch as any).mock.calls[0][0]).toContain('/channels/c1/pins/m1');
  });

  it('returns ok: false on the typical 50-pin-cap 403', async () => {
    (fetch as any).mockResolvedValueOnce(fail(403, 'Maximum number of pins reached'));
    const res = await pinMessage(TOKEN, 'c1', 'm1');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });
});
