import { format } from 'date-fns';

/**
 * Format a message timestamp using the configured date and time formats.
 * Both dateFormat and timeFormat are date-fns format strings.
 */
export const formatMessageTimestamp = (
  date: Date | string,
  dateFormat: string,
  timeFormat: string,
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, `${dateFormat} ${timeFormat}`);
};
