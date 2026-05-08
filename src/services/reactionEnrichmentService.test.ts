import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactionEnrichmentServiceWrapper } from './reactionEnrichmentService';
import { createMockMessage } from '@/test/fixtures';
import type { Message } from 'discrub-core/types/discord-types';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

vi.mock('discrub-core/messages', () => ({
  MessageFetchService: vi.fn(),
  DiscordServiceAdapter: vi.fn(),
}));

describe('reactionEnrichmentService (Pass 1 — populate Message.reactions)', () => {
  let service: ReactionEnrichmentServiceWrapper;
  let mockResolve: ReturnType<typeof vi.fn>;
  let settings: AppSettings;

  const reactionsOn = (overrides: Partial<AppSettings> = {}) =>
    ({
      [DiscrubSetting.REACTIONS_ENABLED]: 'true',
      ...overrides,
    }) as AppSettings;

  const reactionsOff = (overrides: Partial<AppSettings> = {}) =>
    ({
      [DiscrubSetting.REACTIONS_ENABLED]: 'false',
      ...overrides,
    }) as AppSettings;

  beforeEach(async () => {
    service = new ReactionEnrichmentServiceWrapper();
    settings = reactionsOn();

    const { MessageFetchService, DiscordServiceAdapter } = await import('discrub-core/messages');
    vi.mocked(MessageFetchService).mockClear();
    vi.mocked(DiscordServiceAdapter).mockClear();

    mockResolve = vi.fn().mockImplementation(async (msgs: Message[]) =>
      msgs.map((m) => ({
        ...m,
        reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }],
      }))
    );

    vi.mocked(DiscordServiceAdapter).mockReturnValue({} as any);
    vi.mocked(MessageFetchService).mockImplementation(
      () =>
        ({
          resolveMessageReactions: mockResolve,
        }) as any
    );
  });

  describe('short-circuits', () => {
    it('returns input unchanged when REACTIONS_ENABLED is false', async () => {
      const input = [createMockMessage({ id: 'm1', reactions: undefined as any })];

      const result = await service.enrichMessages(input, 'token', reactionsOff());

      expect(result).toBe(input);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it('returns input unchanged when REACTIONS_ENABLED is missing entirely', async () => {
      const input = [createMockMessage({ id: 'm1', reactions: undefined as any })];

      const result = await service.enrichMessages(input, 'token', {} as AppSettings);

      expect(result).toBe(input);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it('returns input unchanged for empty array, does not construct service', async () => {
      const { MessageFetchService } = await import('discrub-core/messages');

      const result = await service.enrichMessages([], 'token', settings);

      expect(result).toEqual([]);
      expect(vi.mocked(MessageFetchService)).not.toHaveBeenCalled();
      expect(mockResolve).not.toHaveBeenCalled();
    });
  });

  describe('enrichment', () => {
    it('routes through MessageFetchService.resolveMessageReactions when setting is on', async () => {
      const input = [
        createMockMessage({ id: 'm1', reactions: undefined as any }),
        createMockMessage({ id: 'm2', reactions: undefined as any }),
      ];

      const result = await service.enrichMessages(input, 'token', settings);

      expect(mockResolve).toHaveBeenCalledOnce();
      expect(mockResolve).toHaveBeenCalledWith(input);
      expect(result).toHaveLength(2);
      expect(result[0].reactions).toEqual([{ emoji: { id: null, name: '👍' }, count: 1 }]);
    });

    it('constructs DiscordServiceAdapter with the provided settings', async () => {
      const { DiscordServiceAdapter } = await import('discrub-core/messages');
      const input = [createMockMessage({ id: 'm1' })];

      await service.enrichMessages(input, 'token', settings);

      expect(vi.mocked(DiscordServiceAdapter)).toHaveBeenCalledWith(settings);
    });

    it('passes token through to MessageFetchService config', async () => {
      const { MessageFetchService } = await import('discrub-core/messages');
      const input = [createMockMessage({ id: 'm1' })];

      await service.enrichMessages(input, 'special-token', settings);

      const config = vi.mocked(MessageFetchService).mock.calls[0][0];
      expect(config.token).toBe('special-token');
    });

    it('passes reactionsEnabled=true to lib settings (lib gates internally)', async () => {
      const { MessageFetchService } = await import('discrub-core/messages');
      const input = [createMockMessage({ id: 'm1' })];

      await service.enrichMessages(input, 'token', settings);

      const config = vi.mocked(MessageFetchService).mock.calls[0][0];
      expect(config.settings.reactionsEnabled).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('forwards onStatus callback to lib config', async () => {
      const { MessageFetchService } = await import('discrub-core/messages');
      const onStatus = vi.fn();
      const input = [createMockMessage({ id: 'm1' })];

      await service.enrichMessages(input, 'token', settings, { onStatus });

      const config = vi.mocked(MessageFetchService).mock.calls[0][0];
      expect(config.onStatus).toBe(onStatus);
    });

    it('forwards shouldStop callback to lib config', async () => {
      const { MessageFetchService } = await import('discrub-core/messages');
      const shouldStop = vi.fn().mockReturnValue(false);
      const input = [createMockMessage({ id: 'm1' })];

      await service.enrichMessages(input, 'token', settings, { shouldStop });

      const config = vi.mocked(MessageFetchService).mock.calls[0][0];
      expect(config.shouldStop).toBe(shouldStop);
    });

    it('callbacks are optional (no shape requirement)', async () => {
      const input = [createMockMessage({ id: 'm1' })];

      const result = await service.enrichMessages(input, 'token', settings);

      expect(result).toHaveLength(1);
    });

    it('fires onWillEnrich exactly once with the input message count when work begins', async () => {
      const onWillEnrich = vi.fn();
      const input = [
        createMockMessage({ id: 'm1' }),
        createMockMessage({ id: 'm2' }),
        createMockMessage({ id: 'm3' }),
      ];

      await service.enrichMessages(input, 'token', settings, { onWillEnrich });

      expect(onWillEnrich).toHaveBeenCalledOnce();
      expect(onWillEnrich).toHaveBeenCalledWith(3);
    });

    it('does NOT fire onWillEnrich when REACTIONS_ENABLED is false', async () => {
      const onWillEnrich = vi.fn();
      const input = [createMockMessage({ id: 'm1' })];

      await service.enrichMessages(input, 'token', reactionsOff(), { onWillEnrich });

      expect(onWillEnrich).not.toHaveBeenCalled();
    });

    it('does NOT fire onWillEnrich when input is empty', async () => {
      const onWillEnrich = vi.fn();

      await service.enrichMessages([], 'token', settings, { onWillEnrich });

      expect(onWillEnrich).not.toHaveBeenCalled();
    });
  });

  describe('failure isolation', () => {
    it('returns input unchanged when lib throws', async () => {
      mockResolve.mockRejectedValue(new Error('Discord 503'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const input = [createMockMessage({ id: 'm1', reactions: undefined as any })];

      const result = await service.enrichMessages(input, 'token', settings);

      expect(result).toBe(input);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('a partial result from lib (some reactions undefined) flows through unchanged', async () => {
      mockResolve.mockResolvedValue([
        { id: 'm1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'm2', reactions: undefined },
      ] as any);

      const result = await service.enrichMessages(
        [createMockMessage({ id: 'm1' }), createMockMessage({ id: 'm2' })],
        'token',
        settings
      );

      expect(result[0].reactions).toEqual([{ emoji: { id: null, name: '👍' }, count: 1 }]);
      expect(result[1].reactions).toBeUndefined();
    });
  });
});
