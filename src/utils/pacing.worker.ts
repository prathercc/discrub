/**
 * Timer host for throttle-immune pacing (#247). Dedicated-worker timers
 * run off the main thread, so Chrome's background-tab timer throttling
 * (1 tick/min after ~5 minutes hidden) never touches them. The page asks
 * for a wake-up by id; the worker answers when the time is up.
 */
self.onmessage = (event: MessageEvent<{ id: number; ms: number }>) => {
  const { id, ms } = event.data;
  setTimeout(() => self.postMessage({ id }), ms);
};
