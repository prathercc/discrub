/**
 * Ask the browser to mark this origin's storage as persistent, which
 * exempts the Discrub-* IndexedDB databases (settings, cache, the
 * supporter key, everything) from best-effort eviction under disk
 * pressure. Chromium grants extensions silently; a denial or a browser
 * without the API just leaves storage best-effort, exactly as today —
 * this can only upgrade, never break.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storageManager = navigator.storage;
    if (!storageManager?.persist) return false;
    if (await storageManager.persisted()) return true;
    return await storageManager.persist();
  } catch {
    return false;
  }
}
