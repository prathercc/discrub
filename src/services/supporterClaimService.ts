/**
 * Supporter key refresh + code redemption calls — the ONLY network
 * requests Discrub makes to a Prather Bytecraft server. Keys are
 * delivered by email when a membership starts (led by a short
 * DSCRB-XXXX-XXXX code that /redeem exchanges once for the full key);
 * the app then renews a monthly key near expiry by presenting the key
 * itself (disclosed in the hub copy; removing the key stops it). Only
 * the key or code is ever sent — never an email address.
 */

export interface SupporterClaimResult {
  key: string;
  tier: 'monthly' | 'lifetime';
  name: string;
  expiresAt: string | null;
}

const REFRESH_ENDPOINT = 'https://api.pratherbytecraft.com/supporter/refresh';
const REDEEM_ENDPOINT = 'https://api.pratherbytecraft.com/supporter/redeem';

/** Shape of a short emailed redemption code after normalization. */
const CODE_PATTERN = /^DSCRB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * Recognize a pasted redemption code (mirrors the server's
 * normalization: trim, uppercase, spaces become dashes). Returns null
 * for anything else — full keys fall through to local verification.
 */
export function normalizeSupporterCode(input: string): string | null {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, '-');
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

/** Error carrying the server's user-facing message (or a fallback). */
export class SupporterClaimError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'SupporterClaimError';
    this.status = status;
  }
}

const FALLBACK_MESSAGE =
  'Could not reach the supporter server. Please try again in a moment.';

async function postForKey(
  endpoint: string,
  body: Record<string, string>,
): Promise<SupporterClaimResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SupporterClaimError(FALLBACK_MESSAGE, null);
  }

  if (!response.ok) {
    let message = FALLBACK_MESSAGE;
    try {
      const body = await response.json();
      if (typeof body?.error === 'string' && body.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the fallback message.
    }
    throw new SupporterClaimError(message, response.status);
  }

  const result = await response.json().catch(() => null);
  if (
    !result ||
    typeof result.key !== 'string' ||
    (result.tier !== 'monthly' && result.tier !== 'lifetime')
  ) {
    throw new SupporterClaimError(FALLBACK_MESSAGE, response.status);
  }
  return result as SupporterClaimResult;
}

export async function requestSupporterKeyRefresh(
  key: string,
): Promise<SupporterClaimResult> {
  return postForKey(REFRESH_ENDPOINT, { key });
}

/** Exchange a short emailed code for the full key (one server call). */
export async function requestSupporterKeyRedemption(
  code: string,
): Promise<SupporterClaimResult> {
  return postForKey(REDEEM_ENDPOINT, { code });
}
