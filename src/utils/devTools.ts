/**
 * Developer-tools gate (#153).
 *
 * The seeding feature is a personal testing aid, not a user-facing
 * affordance, so we hide it behind a localStorage flag toggled via
 * an Easter-egg double-click on a small flask icon in the sidebar
 * footer. A regular user never sees the seed pill or dialog; the dev
 * who knows where to click does.
 *
 * The flag is intentionally not in the Settings dialog — exposing it
 * there would advertise the feature, which defeats the point.
 */

export const DEV_TOOLS_KEY = 'discrub:devTools';

/**
 * Custom event name fired on same-tab toggles. The native `storage`
 * event only fires across tabs, so without this the flask icon
 * wouldn't update the rest of the UI in the same window where the
 * toggle happened.
 */
export const DEV_TOOLS_EVENT = 'discrub:devToolsChanged';

export function isDevToolsEnabled(): boolean {
  try {
    return localStorage.getItem(DEV_TOOLS_KEY) === 'true';
  } catch {
    // SSR / sandboxed iframes / Safari private mode without localStorage
    // — never enabled in those contexts, which is the safe default.
    return false;
  }
}

/** Flip the flag and notify same-tab listeners. */
export function toggleDevTools(): boolean {
  try {
    const next = !isDevToolsEnabled();
    if (next) {
      localStorage.setItem(DEV_TOOLS_KEY, 'true');
    } else {
      localStorage.removeItem(DEV_TOOLS_KEY);
    }
    window.dispatchEvent(new CustomEvent(DEV_TOOLS_EVENT, { detail: next }));
    return next;
  } catch {
    return false;
  }
}
