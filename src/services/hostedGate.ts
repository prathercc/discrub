import { isExtensionMode } from '@/extension/messaging';

/**
 * Hosted "Bleeding Edge" gate flag. The hosted build
 * (discrub.pratherbytecraft.com) is the plain web build with
 * VITE_HOSTED_GATE=true, which makes the landing page ask for a
 * supporter key (persisted) next to the Discord token (memory only)
 * and refuse entry without a key that carries the `hosted` feature.
 *
 * Nothing else changes between the web and hosted builds: same
 * dialog, same services, same storage. The dev-only window override
 * lets Cypress exercise the gate on the ordinary dev server.
 */
/**
 * Whether the running build carries the Bleeding Edge wordmark: the hosted
 * gate build, plus the local web dev server (unreleased code by definition).
 * Only branding keys off this; the key gate itself stays on
 * `isHostedGateEnabled()`.
 */
export function isBleedingEdgeBuild(): boolean {
  if (isHostedGateEnabled()) return true;
  return import.meta.env.MODE === 'development' && !isExtensionMode();
}

export function isHostedGateEnabled(): boolean {
  if (import.meta.env.VITE_HOSTED_GATE === 'true') return true;
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return (window as { __hostedGateOverride__?: boolean }).__hostedGateOverride__ === true;
  }
  return false;
}
