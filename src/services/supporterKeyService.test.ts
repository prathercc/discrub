import { describe, it, expect, beforeAll } from 'vitest';
import {
  isSupporterFeatureLive,
  liveSupporterFeatures,
  verifySupporterKey,
  decodeSupporterKeyPayload,
  SUPPORTER_PUBLIC_KEYS,
  type SupporterKeyPayload,
} from './supporterKeyService';

/**
 * Fixture keys are generated per-run with WebCrypto and injected via
 * the publicKeys option — the same code path the baked registry uses.
 */

const NOW_MS = 1_760_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);
const DAY_S = 24 * 60 * 60;

let publicKeyPem: string;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

function bytesToB64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function derToPem(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  const lines = b64.match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function buildPayload(overrides: Partial<SupporterKeyPayload> = {}): SupporterKeyPayload {
  return {
    v: 2,
    kid: '2026-2',
    jti: 'a1b2c3d4e5f6a7b8',
    name: 'Aaron P.',
    eh: '0123456789abcdef',
    ent: { themes: NOW_S + 30 * DAY_S },
    iat: NOW_S - DAY_S,
    exp: NOW_S + 30 * DAY_S,
    ...overrides,
  };
}

async function signKey(
  payload: SupporterKeyPayload,
  key: CryptoKey = privateKey,
): Promise<string> {
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'Ed25519',
    key,
    new TextEncoder().encode(body),
  );
  return `DSCRB-${body}.${bytesToB64Url(new Uint8Array(signature))}`;
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  publicKeyPem = derToPem(await crypto.subtle.exportKey('spki', pair.publicKey));

  const otherPair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  otherPrivateKey = otherPair.privateKey;
});

const testKeys = () => ({ publicKeys: { '2026-2': publicKeyPem }, nowMs: NOW_MS });

describe('supporterKeyService', () => {
  describe('verifySupporterKey', () => {
    it('accepts a correctly signed, unexpired monthly key', async () => {
      const key = await signKey(buildPayload());
      const result = await verifySupporterKey(key, testKeys());
      expect(result.status).toBe('valid');
      expect(result.payload?.name).toBe('Aaron P.');
      expect(result.payload?.ent).toEqual({ themes: NOW_S + 30 * DAY_S });
    });

    it('accepts a perpetual key with null exp regardless of clock', async () => {
      const key = await signKey(buildPayload({ ent: { themes: null }, exp: null }));
      const result = await verifySupporterKey(key, {
        ...testKeys(),
        nowMs: NOW_MS + 1000 * DAY_S * 1000,
      });
      expect(result.status).toBe('valid');
    });

    it('tolerates surrounding whitespace from a copy-paste', async () => {
      const key = await signKey(buildPayload());
      const result = await verifySupporterKey(`  ${key}\n`, testKeys());
      expect(result.status).toBe('valid');
    });

    it('rejects a key signed by a different private key', async () => {
      const key = await signKey(buildPayload(), otherPrivateKey);
      const result = await verifySupporterKey(key, testKeys());
      expect(result.status).toBe('invalid');
    });

    it('rejects a tampered payload (signature over the original body)', async () => {
      const key = await signKey(buildPayload());
      const [prefix, signature] = key.split('.');
      const tamperedBody = bytesToB64Url(
        new TextEncoder().encode(JSON.stringify(buildPayload({ ent: { themes: null }, exp: null }))),
      );
      const tampered = `${prefix.slice(0, 'DSCRB-'.length)}${tamperedBody}.${signature}`;
      const result = await verifySupporterKey(tampered, testKeys());
      expect(result.status).toBe('invalid');
    });

    it('rejects malformed strings without touching crypto', async () => {
      for (const bad of ['', 'hello', 'DSCRB-', 'DSCRB-abc', 'DSCRB-a.b.c', 'DSCRB-!!.??']) {
        expect((await verifySupporterKey(bad, testKeys())).status).toBe('invalid');
      }
    });

    it('rejects an unknown kid', async () => {
      const key = await signKey(buildPayload({ kid: '2026-1' }));
      const result = await verifySupporterKey(key, testKeys());
      expect(result.status).toBe('invalid');
    });

    it('rejects a v1 (tier-shaped) payload even if signed', async () => {
      const v1 = { ...buildPayload(), v: 1, tier: 'monthly' } as unknown as Record<string, unknown>;
      delete v1.ent;
      const key = await signKey(v1 as unknown as SupporterKeyPayload);
      expect((await verifySupporterKey(key, testKeys())).status).toBe('invalid');
    });

    it('rejects an entitlement map with unknown features or bad values', async () => {
      const bogus = await signKey(buildPayload({ ent: { vip: 1 } as never }));
      expect((await verifySupporterKey(bogus, testKeys())).status).toBe('invalid');
      const badValue = await signKey(buildPayload({ ent: { themes: 'soon' } as never }));
      expect((await verifySupporterKey(badValue, testKeys())).status).toBe('invalid');
    });

    it('rejects a payload with the wrong shape even if signed', async () => {
      const key = await signKey({ v: 2 } as unknown as SupporterKeyPayload);
      const result = await verifySupporterKey(key, testKeys());
      expect(result.status).toBe('invalid');
    });

    it('reports expired when past exp plus clock skew', async () => {
      const key = await signKey(buildPayload({ exp: NOW_S - 3 * DAY_S }));
      const result = await verifySupporterKey(key, testKeys());
      expect(result.status).toBe('expired');
      expect(result.payload?.name).toBe('Aaron P.');
    });

    it('stays valid within the 48h clock-skew window past exp', async () => {
      const key = await signKey(buildPayload({ exp: NOW_S - DAY_S }));
      const result = await verifySupporterKey(key, testKeys());
      expect(result.status).toBe('valid');
    });

    it('reports revoked when the jti is on the revocation list', async () => {
      const key = await signKey(buildPayload({ jti: 'revoked-one' }));
      const result = await verifySupporterKey(key, {
        ...testKeys(),
        revokedJtis: ['other', 'revoked-one'],
      });
      expect(result.status).toBe('revoked');
    });

    it('revocation wins over expiry so the copy is honest', async () => {
      const key = await signKey(buildPayload({ jti: 'revoked-one', exp: NOW_S - 30 * DAY_S }));
      const result = await verifySupporterKey(key, {
        ...testKeys(),
        revokedJtis: ['revoked-one'],
      });
      expect(result.status).toBe('revoked');
    });

    it('ignores an empty revocation list (fail-open default)', async () => {
      const key = await signKey(buildPayload());
      const result = await verifySupporterKey(key, { ...testKeys(), revokedJtis: [] });
      expect(result.status).toBe('valid');
    });
  });

  describe('decodeSupporterKeyPayload', () => {
    it('decodes without verifying', async () => {
      const key = await signKey(buildPayload({ name: 'Display Only' }), otherPrivateKey);
      expect(decodeSupporterKeyPayload(key)?.name).toBe('Display Only');
    });

    it('returns null for malformed input', () => {
      expect(decodeSupporterKeyPayload('nope')).toBeNull();
      expect(decodeSupporterKeyPayload('DSCRB-%%%.###')).toBeNull();
    });
  });

  describe('baked public key registry', () => {
    it('never contains the burned 2026-1 kid', () => {
      expect(SUPPORTER_PUBLIC_KEYS['2026-1']).toBeUndefined();
    });

    it('every registered PEM imports as a valid Ed25519 public key', async () => {
      // This is the forcing function that keeps a placeholder PEM from
      // ever shipping: the real key from the signing_keys table must be
      // baked in before this suite goes green.
      for (const [kid, pem] of Object.entries(SUPPORTER_PUBLIC_KEYS)) {
        const body = pem
          .replace(/-----BEGIN PUBLIC KEY-----/, '')
          .replace(/-----END PUBLIC KEY-----/, '')
          .replace(/\s+/g, '');
        const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
        await expect(
          crypto.subtle.importKey('spki', der as unknown as ArrayBuffer, { name: 'Ed25519' }, false, ['verify']),
          `kid ${kid} must hold a real Ed25519 SPKI public key`,
        ).resolves.toBeDefined();
      }
    });
  });

  describe('per-feature liveness', () => {
    it('reports each feature from the map with clock-skew tolerance', () => {
      const payload = buildPayload({
        ent: { themes: NOW_S - DAY_S, hosted: NOW_S + 10 * DAY_S },
        exp: NOW_S + 10 * DAY_S,
      });
      // themes ended a day ago: still inside the 48h skew window.
      expect(isSupporterFeatureLive(payload, 'themes', NOW_MS)).toBe(true);
      expect(isSupporterFeatureLive(payload, 'themes', NOW_MS + 3 * DAY_S * 1000)).toBe(false);
      expect(isSupporterFeatureLive(payload, 'hosted', NOW_MS)).toBe(true);
      expect(liveSupporterFeatures(payload, NOW_MS + 3 * DAY_S * 1000)).toEqual(['hosted']);
    });

    it('treats absent features as not included and null as perpetual', () => {
      const payload = buildPayload({ ent: { themes: null } });
      expect(isSupporterFeatureLive(payload, 'themes', NOW_MS + 1e12)).toBe(true);
      expect(isSupporterFeatureLive(payload, 'hosted')).toBe(false);
      expect(isSupporterFeatureLive(null, 'themes')).toBe(false);
      expect(liveSupporterFeatures(payload)).toEqual(['themes']);
    });
  });
});
