import type { Message } from 'discrub-core/types/discord-types';

export interface MentionCount {
  userId: string;
  username: string;
  count: number;
}

/**
 * Generate mention counts from messages.
 * Counts <@userId> and <@!userId> (nickname mention) patterns.
 * Ignores mentions inside code blocks.
 */
export function generateMentionCounts(
  messages: Message[],
  userMap: Record<string, { userName?: string; displayName?: string; nick?: string }>
): MentionCount[] {
  const counts: Record<string, number> = {};
  const mentionRegex = /<@!?(\d+)>/g;
  const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;

  messages.forEach((msg) => {
    if (!msg.content) return;

    // Remove code blocks before counting mentions
    const contentWithoutCode = msg.content.replace(codeBlockRegex, '');

    let match;
    while ((match = mentionRegex.exec(contentWithoutCode)) !== null) {
      const userId = match[1];
      counts[userId] = (counts[userId] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([userId, count]) => {
      const user = userMap[userId];
      const username = user?.nick || user?.displayName || user?.userName || userId;
      return { userId, username, count };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Export mention counts to CSV string.
 */
export function exportMentionCountsCSV(counts: MentionCount[]): string {
  const header = 'Username,User ID,Mention Count';
  const rows = counts.map((c) => {
    // Escape commas and quotes in usernames
    const escaped = c.username.includes(',') || c.username.includes('"')
      ? `"${c.username.replace(/"/g, '""')}"`
      : c.username;
    return `${escaped},${c.userId},${c.count}`;
  });
  return [header, ...rows].join('\n');
}
