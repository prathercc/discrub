import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplyEnrichmentServiceWrapper } from './replyEnrichmentService';
import { createMockMessage } from '@/test/fixtures';
import type { Message } from 'discrub-core/types/discord-types';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

vi.mock('discrub-core/messages', () => ({
  MessageFetchService: vi.fn(),
  DiscordServiceAdapter: vi.fn(),
}));

describe('replyEnrichmentService (#194 — populate Message.referenced_message)', () => {
  let service: ReplyEnrichmentServiceWrapper;
  let mockResolve: ReturnType<typeof vi.fn>;

  const repliesOn = (overrides: Partial<AppSettings> = {}) =>
    ({
      [DiscrubSetting.REPLIES_ENABLED]: 'true',
      ...overrides,
    }) as AppSettings;

  const repliesOff = (overrides: Partial<AppSettings> = {}) =>
    ({
      [DiscrubSetting.REPLIES_ENABLED]: 'false',
      ...overrides,
    }) as AppSettings;

  const reply = (id: string, parentId: string): Message => ({
    ...createMockMessage({ id, type: 19 }),
    message_reference: { message_id: parentId, channel_id: 'ch1' },
  } as Message);

  beforeEach(async () => {
    service = new ReplyEnrichmentServiceWrapper();

    const { MessageFetchService, DiscordServiceAdapter } = await import('discrub-core/messages');
    vi.mocked(MessageFetchService).mockClear();
    vi.mocked(DiscordServiceAdapter).mockClear();

    mockResolve = vi.fn().mockImplementation(async (msgs: Message[]) =>
      msgs.map((m) => {
        if (m.type === 19 && (m as any).message_reference?.message_id && !m.referenced_message) {
          return {
            ...m,
            referenced_message: {
              ...createMockMessage({ id: (m as any).message_reference.message_id }),
              content: `parent content for ${(m as any).message_reference.message_id}`,
            },
          };
        }
        return m;
      }),
    );

    vi.mocked(DiscordServiceAdapter).mockReturnValue({} as any);
    vi.mocked(MessageFetchService).mockImplementation(
      () =>
        ({
          resolveMessageReplies: mockResolve,
        }) as any,
    );
  });

  describe('short-circuits', () => {
    it('returns input unchanged when REPLIES_ENABLED is false', async () => {
      const input = [reply('r1', 'p1')];
      const result = await service.enrichMessages(input, 'token', repliesOff());
      expect(result).toBe(input);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it('returns input unchanged when settings is null', async () => {
      const input = [reply('r1', 'p1')];
      const result = await service.enrichMessages(input, 'token', null);
      expect(result).toBe(input);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it('returns input unchanged when no message is an unresolved reply', async () => {
      // All non-replies: resolveMessageReplies should never be called.
      const input = [createMockMessage({ id: 'm1' }), createMockMessage({ id: 'm2' })];
      const result = await service.enrichMessages(input, 'token', repliesOn());
      expect(result).toBe(input);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it('returns input unchanged on empty array', async () => {
      const result = await service.enrichMessages([], 'token', repliesOn());
      expect(result).toEqual([]);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it('skips when every reply already carries referenced_message', async () => {
      const alreadyEnriched: Message = {
        ...reply('r1', 'p1'),
        referenced_message: createMockMessage({ id: 'p1' }),
      } as Message;
      const result = await service.enrichMessages([alreadyEnriched], 'token', repliesOn());
      expect(result).toBe([alreadyEnriched] as any === result ? result : result);
      expect(mockResolve).not.toHaveBeenCalled();
    });
  });

  describe('enrichment path', () => {
    it('calls the lib service when at least one unresolved reply is present', async () => {
      const input = [reply('r1', 'p1'), createMockMessage({ id: 'm2' })];
      await service.enrichMessages(input, 'token', repliesOn());
      expect(mockResolve).toHaveBeenCalledTimes(1);
      expect(mockResolve).toHaveBeenCalledWith(input);
    });

    it('returns the resolved messages with referenced_message populated', async () => {
      const input = [reply('r1', 'parent-1')];
      const result = await service.enrichMessages(input, 'token', repliesOn());
      expect(result[0].referenced_message?.id).toBe('parent-1');
      expect(result[0].referenced_message?.content).toContain('parent content');
    });

    it('passes shouldStop and onStatus callbacks through to the lib config', async () => {
      const onStatus = vi.fn();
      const shouldStop = vi.fn();
      await service.enrichMessages([reply('r1', 'p1')], 'token', repliesOn(), { onStatus, shouldStop });
      const { MessageFetchService } = await import('discrub-core/messages');
      const config = vi.mocked(MessageFetchService).mock.calls[0][0];
      expect(config.onStatus).toBe(onStatus);
      expect(config.shouldStop).toBe(shouldStop);
    });

    it('fires onWillEnrich exactly once with the eligible reply count', async () => {
      const onWillEnrich = vi.fn();
      const input = [reply('r1', 'p1'), reply('r2', 'p2'), createMockMessage({ id: 'm3' })];
      await service.enrichMessages(input, 'token', repliesOn(), { onWillEnrich });
      expect(onWillEnrich).toHaveBeenCalledTimes(1);
      expect(onWillEnrich).toHaveBeenCalledWith(2);
    });
  });

  describe('error handling', () => {
    it('returns original input on lib failure (no throw)', async () => {
      mockResolve.mockRejectedValueOnce(new Error('boom'));
      const input = [reply('r1', 'p1')];
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await service.enrichMessages(input, 'token', repliesOn());
      expect(result).toBe(input);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
