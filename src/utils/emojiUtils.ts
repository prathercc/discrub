/**
 * Get a unique key for a Discord emoji (used for lookups, state, and comparison).
 * Custom emojis: "name:id", standard emojis: the unicode character.
 */
export function getEmojiKey(emoji: { id?: string | null; name?: string | null }): string {
  if (emoji.id) return `${emoji.name}:${emoji.id}`;
  return emoji.name || '';
}
