import { describe, it, expect } from 'vitest';
import { generateMentionCounts, exportMentionCountsCSV } from './analyticsUtils';
import type { Message } from 'discrub-core/types/discord-types';

const createMessage = (content: string): Message =>
  ({ content } as Message);

const userMap = {
  '111': { userName: 'Alice', displayName: 'Alice Display', nick: undefined },
  '222': { userName: 'Bob', displayName: undefined, nick: 'Bobby' },
  '333': { userName: 'Charlie', displayName: undefined, nick: undefined },
};

describe('generateMentionCounts', () => {
  it('should count <@userId> mentions correctly', () => {
    const messages = [
      createMessage('Hello <@111> and <@222>!'),
      createMessage('<@111> are you there?'),
    ];
    const counts = generateMentionCounts(messages, userMap);
    expect(counts[0]).toEqual({ userId: '111', username: 'Alice Display', count: 2 });
    expect(counts[1]).toEqual({ userId: '222', username: 'Bobby', count: 1 });
  });

  it('should handle <@!userId> nickname mention format', () => {
    const messages = [createMessage('Hey <@!111> what up')];
    const counts = generateMentionCounts(messages, userMap);
    expect(counts[0]).toEqual({ userId: '111', username: 'Alice Display', count: 1 });
  });

  it('should ignore mentions inside code blocks', () => {
    const messages = [
      createMessage('Look at this: ```<@111>``` and `<@222>`'),
      createMessage('<@333> is real'),
    ];
    const counts = generateMentionCounts(messages, userMap);
    expect(counts).toHaveLength(1);
    expect(counts[0].userId).toBe('333');
  });

  it('should return sorted by count descending', () => {
    const messages = [
      createMessage('<@222> <@222> <@222>'),
      createMessage('<@111> <@111>'),
      createMessage('<@333>'),
    ];
    const counts = generateMentionCounts(messages, userMap);
    expect(counts[0].count).toBe(3);
    expect(counts[1].count).toBe(2);
    expect(counts[2].count).toBe(1);
  });

  it('should use nick > displayName > userName > userId for username', () => {
    const messages = [
      createMessage('<@222>'), // has nick "Bobby"
      createMessage('<@111>'), // has displayName "Alice Display"
      createMessage('<@999>'), // not in userMap
    ];
    const counts = generateMentionCounts(messages, userMap);
    const nickUser = counts.find((c) => c.userId === '222');
    const displayUser = counts.find((c) => c.userId === '111');
    const unknownUser = counts.find((c) => c.userId === '999');
    expect(nickUser?.username).toBe('Bobby');
    expect(displayUser?.username).toBe('Alice Display');
    expect(unknownUser?.username).toBe('999');
  });

  it('should return empty array for messages with no mentions', () => {
    const messages = [createMessage('Hello world'), createMessage('No mentions here')];
    const counts = generateMentionCounts(messages, userMap);
    expect(counts).toEqual([]);
  });

  it('should handle empty messages array', () => {
    const counts = generateMentionCounts([], userMap);
    expect(counts).toEqual([]);
  });

  it('should handle messages with null content', () => {
    const messages = [{ content: null } as unknown as Message];
    const counts = generateMentionCounts(messages, userMap);
    expect(counts).toEqual([]);
  });
});

describe('exportMentionCountsCSV', () => {
  it('should generate valid CSV with headers', () => {
    const counts = [
      { userId: '111', username: 'Alice', count: 5 },
      { userId: '222', username: 'Bob', count: 3 },
    ];
    const csv = exportMentionCountsCSV(counts);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Username,User ID,Mention Count');
    expect(lines[1]).toBe('Alice,111,5');
    expect(lines[2]).toBe('Bob,222,3');
  });

  it('should escape commas in usernames', () => {
    const counts = [{ userId: '111', username: 'Last, First', count: 1 }];
    const csv = exportMentionCountsCSV(counts);
    expect(csv).toContain('"Last, First"');
  });

  it('should escape quotes in usernames', () => {
    const counts = [{ userId: '111', username: 'The "Great" One', count: 1 }];
    const csv = exportMentionCountsCSV(counts);
    expect(csv).toContain('"The ""Great"" One"');
  });

  it('should handle empty counts', () => {
    const csv = exportMentionCountsCSV([]);
    expect(csv).toBe('Username,User ID,Mention Count');
  });
});
