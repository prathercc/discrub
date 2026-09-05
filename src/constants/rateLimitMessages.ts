/**
 * User-facing text for the rate-limit storm stop (#254). Lives apart from
 * the service singleton so UI code can import it without pulling the
 * service module (which many test suites mock).
 */
export const RATE_LIMIT_STOP_TOAST =
  'Stopped: Discord is rate limiting this account. Wait 10 minutes before trying again.';

/** Status-log line written when discrub-core abandons a request after repeated 429s. */
export const RATE_LIMIT_STOP_MESSAGE =
  'Discord is rate limiting this account heavily. Stopped the operation to protect your account. Wait at least 10 minutes before starting another one.';
