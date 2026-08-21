/**
 * Supporter claim call — the ONLY network request Discrub makes to a
 * Prather Bytecraft server. Fired when the user claims a key with
 * their Ko-fi email (user-initiated) and again near expiry to refresh
 * a monthly key (disclosed at claim time; removing the key stops it).
 * Sends only the email and optional display name.
 */

export interface SupporterClaimResult {
  key: string;
  tier: 'monthly' | 'lifetime';
  name: string;
  expiresAt: string | null;
}

const CLAIM_ENDPOINT = 'https://api.pratherbytecraft.com/supporter/claim';

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

export async function requestSupporterKey(
  email: string,
  displayName?: string,
): Promise<SupporterClaimResult> {
  let response: Response;
  try {
    response = await fetch(CLAIM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        displayName && displayName.trim()
          ? { email, displayName: displayName.trim() }
          : { email },
      ),
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
