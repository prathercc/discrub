import { t } from '@/i18n';

export function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return t('timeAgo.justNow');

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('timeAgo.minutes', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('timeAgo.hours', { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 30) return t('timeAgo.days', { count: days });

  const months = Math.floor(days / 30);
  return t('timeAgo.months', { count: months });
}
