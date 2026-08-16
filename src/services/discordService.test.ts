import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings } from 'discrub-core/types/discrub-types';

const constructorSpy = vi.fn();

vi.mock('discrub-core/discord-service', () => ({
  DiscordService: class {
    onRateLimit?: unknown;
    onDelay?: unknown;
    constructor(...args: unknown[]) {
      constructorSpy(...args);
    }
  },
}));

describe('discordService singleton', () => {
  beforeEach(() => {
    vi.resetModules();
    constructorSpy.mockClear();
  });

  it('constructs the service with autoDelay off — the app owns all pacing (#241)', async () => {
    const { getDiscordService } = await import('./discordService');
    getDiscordService();

    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(constructorSpy).toHaveBeenCalledWith(undefined, { autoDelay: false });
  });

  it('keeps autoDelay off when reinitialized with settings', async () => {
    const { getDiscordService } = await import('./discordService');
    const settings = { searchDelay2: 2 } as unknown as AppSettings;

    getDiscordService();
    getDiscordService(settings);

    expect(constructorSpy).toHaveBeenCalledTimes(2);
    expect(constructorSpy).toHaveBeenLastCalledWith(settings, { autoDelay: false });
  });

  it('reuses the instance when called without settings', async () => {
    const { getDiscordService } = await import('./discordService');

    const first = getDiscordService();
    const second = getDiscordService();

    expect(first).toBe(second);
    expect(constructorSpy).toHaveBeenCalledTimes(1);
  });
});
