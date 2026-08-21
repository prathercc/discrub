import type { SupporterEntitlementMap } from './supporterKeyService';

/**
 * Supporter key refresh + redemption calls — the ONLY network requests
 * Discrub makes to a Prather Bytecraft server, and only ever by a
 * client that holds a key. Keys are delivered by email when a purchase
 * lands (a short DSCRB-XXXX-XXXX form that /redeem exchanges for the
 * full signed key); the app then checks in about once a day by
 * presenting the key itself so new purchases and renewals arrive on
 * their own (disclosed in the hub copy; removing the key stops it).
 * Only the key is ever sent, never an email address.
 *
 * Wording: user-facing copy says "key" for both forms. "Code" survives
 * only in identifiers for the short, server-exchanged form.
 */

export interface SupporterClaimResult {
  key: string;
  /** feature -> unix expiry (null = never); absent = not included */
  ent: SupporterEntitlementMap;
  name: string;
  expiresAt: string | null;
}

/** The server's answer when a presented key's owner holds nothing live. */
export const SUPPORTER_ACCESS_ENDED_STATUS = 410;

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
    typeof result.ent !== 'object' ||
    result.ent === null
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

/** Exchange the short emailed key form for the full signed key (one server call). */
export async function requestSupporterKeyRedemption(
  code: string,
): Promise<SupporterClaimResult> {
  return postForKey(REDEEM_ENDPOINT, { code });
}
