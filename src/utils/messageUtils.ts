import type { Message } from 'discrub-core/types/discord-types';

const THREAD_STARTER_MESSAGE_TYPE = 21;

/**
 * Returns the effective display content for a message.
 * Type 21 (thread starter) messages have empty `content` — the actual text
 * lives in `referenced_message.content`.
 */
export const getMessageContent = (message: Message): string => {
  if (message.type === THREAD_STARTER_MESSAGE_TYPE && message.referenced_message?.content) {
    return message.referenced_message.content;
  }
  return message.content || '';
};
