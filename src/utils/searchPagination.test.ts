import { describe, it, expect, vi, beforeEach } from 'vitest';
import { iterateSearchMessagesRedux, nextMilestone } from './searchPagination';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFetchSearchMessageData = vi.fn();
const mockIterateSearchResults = vi.fn();

vi.mock('@/services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    fetchSearchMessageData: mockFetchSearchMessageData,
    iterateSearchResults: mockIterateSearchResults,
  })),
}));

vi.mock('@features/app/appSlice', () => ({
  selectSearchDelay: vi.fn(() => 1),
  selectDelayModifier: vi.fn(() => 0),
}));

vi.mock('@utils/operationLoopUtils', () => ({
  checkCancelled: vi.fn(() => false),
  waitWhilePaused: vi.fn().mockResolvedValue(undefined),
  cancellableDelay: vi.fn().mockResolvedValue(false),
}));

vi.mock('@utils/delayUtils', () => ({
  calculateRandomDelay: vi.fn(() => ({ delayMs: 0, delaySec: 0 })),
}));

const baseCriteria: SearchCriteria = {
  userIds: [],
  mentionIds: [],
  selectedHasTypes: [],
  channelIds: [],
  searchMessageContent: null,
  searchAfterDate: null,
  searchBeforeDate: null,
  isPinned: 'null',
} as unknown as SearchCriteria;

const mockGetState: any = vi.fn(() => ({
  app: { settings: { searchDelay2: 1, delayModifier2: 0 } },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('nextMilestone', () => {
  it('returns 5 when current is 0 (small-op step)', () => {
    expect(nextMilestone(0)).toBe(5);
  });

  it('uses a 5-step ladder below 25', () => {
    expect(nextMilestone(1)).toBe(5);
    expect(nextMilestone(4)).toBe(5);
    expect(nextMilestone(5)).toBe(10);
    expect(nextMilestone(7)).toBe(10);
    expect(nextMilestone(20)).toBe(25);
    expect(nextMilestone(24)).toBe(25);
  });

  it('uses a 25-step ladder between 25 and 100', () => {
    expect(nextMilestone(25)).toBe(50);
    expect(nextMilestone(26)).toBe(50);
    expect(nextMilestone(49)).toBe(50);
    expect(nextMilestone(50)).toBe(75);
    expect(nextMilestone(99)).toBe(100);
  });

  it('uses a 100-step ladder at and above 100', () => {
    expect(nextMilestone(100)).toBe(200);
    expect(nextMilestone(101)).toBe(200);
    expect(nextMilestone(250)).toBe(300);
    expect(nextMilestone(999)).toBe(1000);
  });
});

describe('iterateSearchMessagesRedux', () => {
  beforeEach(() => {
    mockFetchSearchMessageData.mockReset();
    mockIterateSearchResults.mockReset();
  });

  it('forwards options to DiscordService.iterateSearchResults and yields each page', async () => {
    const fakePages = [
      { messages: [{ id: 'a' } as any], totalResults: 2, pageIndex: 0, aggregatedCount: 1 },
      { messages: [{ id: 'b' } as any], totalResults: 2, pageIndex: 1, aggregatedCount: 2 },
    ];
    mockIterateSearchResults.mockImplementation(async function* () {
      for (const p of fakePages) yield p;
    });

    const collected: any[] = [];
    for await (const page of iterateSearchMessagesRedux({
      token: 'tok',
      channelId: 'ch',
      guildId: 'g',
      criteria: baseCriteria,
      getState: mockGetState,
    })) {
      collected.push(page);
    }

    expect(collected).toHaveLength(2);
    expect(collected.map((p) => p.messages[0].id)).toEqual(['a', 'b']);

    // Confirm lib helper received the expected options shape
    const call = mockIterateSearchResults.mock.calls[0][0];
    expect(call.token).toBe('tok');
    expect(call.channelId).toBe('ch');
    expect(call.guildId).toBe('g');
    expect(typeof call.shouldStop).toBe('function');
    expect(typeof call.onBetweenPages).toBe('function');
  });

  it('stops yielding when checkCancelled returns true between pages', async () => {
    const opUtils = await import('@utils/operationLoopUtils');
    const checkCancelledMock = vi.mocked(opUtils.checkCancelled);
    // Cancel on the second check (after the first yield has happened)
    checkCancelledMock.mockReturnValueOnce(false);
    checkCancelledMock.mockReturnValue(true);

    mockIterateSearchResults.mockImplementation(async function* () {
      yield { messages: [{ id: '1' } as any], totalResults: 3, pageIndex: 0, aggregatedCount: 1 };
      yield { messages: [{ id: '2' } as any], totalResults: 3, pageIndex: 1, aggregatedCount: 2 };
      yield { messages: [{ id: '3' } as any], totalResults: 3, pageIndex: 2, aggregatedCount: 3 };
    });

    const collected: any[] = [];
    for await (const page of iterateSearchMessagesRedux({
      token: 'tok',
      channelId: 'ch',
      guildId: null,
      criteria: baseCriteria,
      getState: mockGetState,
    })) {
      collected.push(page);
    }

    expect(collected).toHaveLength(1);
    // reset for later tests
    checkCancelledMock.mockReturnValue(false);
  });
});
