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
export function isHostedGateEnabled(): boolean {
  if (import.meta.env.VITE_HOSTED_GATE === 'true') return true;
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return (window as { __hostedGateOverride__?: boolean }).__hostedGateOverride__ === true;
  }
  return false;
}
