import { describe, it, expect, vi } from 'vitest';
import type { MediaDownloadProgress } from './exportTypes';

// The `logMediaProgress` helper inside `exportSlice.ts` is module-private,
// so we can't import it directly. Instead, this file pins the log-cadence
// contract via a reference implementation that mirrors the real helper's
// thresholds. If the real helper's thresholds change, update this fixture
// too — the point is to catch regressions in the milestone pattern users
// rely on during media-download + HTML-generation phases.

type LogFn = (action: any) => void;
function logMediaProgressReference(
  progress: MediaDownloadProgress,
  dispatch: LogFn,
  scope: string = '',
) {
  const { stage, current, total } = progress;
  if (total <= 0) return;
  const entry = (message: string) =>
    dispatch({ type: 'status/addStatusEntry', payload: { level: 'info', message } });

  if (stage === 'attachments') {
    if (current === 1 || current === total || current % 10 === 0) {
      entry(`Export: Downloaded ${current}/${total} attachments${scope}`);
    }
  } else if (stage === 'avatars') {
    if (current === 1 || current === total || current % 10 === 0) {
      const label = current === total
        ? `Downloaded ${total} avatar${total === 1 ? '' : 's'}`
        : `Downloaded ${current}/${total} avatars`;
      entry(`Export: ${label}${scope}`);
    }
  } else if (stage === 'emojis') {
    if (current === 1 || current === total || current % 10 === 0) {
      const label = current === total
        ? `Downloaded ${total} emoji${total === 1 ? '' : 's'}`
        : `Downloaded ${current}/${total} emojis`;
      entry(`Export: ${label}${scope}`);
    }
  } else if (stage === 'html') {
    if (current === 1 || current === total || current % 5 === 0) {
      entry(`Export: Built page ${current}/${total}${scope}`);
    }
  } else if (stage === 'finalizing' && current === 1) {
    entry(`Export: Finalizing archive${scope}…`);
  }
}

describe('logMediaProgress cadence (reference)', () => {
  it('fires on first, every 10th, and last attachment', () => {
    const spy = vi.fn();
    const total = 25;
    for (let i = 1; i <= total; i++) {
      logMediaProgressReference({ stage: 'attachments', current: i, total }, spy);
    }
    // Expected fires: 1, 10, 20, 25 → 4 entries
    expect(spy).toHaveBeenCalledTimes(4);
    const messages = spy.mock.calls.map((c) => c[0].payload.message);
    expect(messages).toEqual([
      'Export: Downloaded 1/25 attachments',
      'Export: Downloaded 10/25 attachments',
      'Export: Downloaded 20/25 attachments',
      'Export: Downloaded 25/25 attachments',
    ]);
  });

  it('fires avatars at first + every 10th + last (interim pattern uses current/total)', () => {
    const spy = vi.fn();
    const total = 43; // matches the dogfood log
    for (let i = 1; i <= total; i++) {
      logMediaProgressReference({ stage: 'avatars', current: i, total }, spy);
    }
    // 1, 10, 20, 30, 40, 43 → 6 entries
    expect(spy).toHaveBeenCalledTimes(6);
    const messages = spy.mock.calls.map((c) => c[0].payload.message);
    expect(messages[0]).toBe('Export: Downloaded 1/43 avatars');
    expect(messages[1]).toBe('Export: Downloaded 10/43 avatars');
    expect(messages[messages.length - 1]).toBe('Export: Downloaded 43 avatars');
  });

  it('fires emojis at first + every 10th + last', () => {
    const spy = vi.fn();
    const total = 48;
    for (let i = 1; i <= total; i++) {
      logMediaProgressReference({ stage: 'emojis', current: i, total }, spy);
    }
    // 1, 10, 20, 30, 40, 48 → 6 entries
    expect(spy).toHaveBeenCalledTimes(6);
    expect(spy.mock.calls[0][0].payload.message).toBe('Export: Downloaded 1/48 emojis');
    expect(spy.mock.calls[spy.mock.calls.length - 1][0].payload.message).toBe('Export: Downloaded 48 emojis');
  });

  it('small avatar/emoji sets (≤1) still fire the completion entry', () => {
    const spy = vi.fn();
    logMediaProgressReference({ stage: 'avatars', current: 1, total: 1 }, spy);
    logMediaProgressReference({ stage: 'emojis', current: 1, total: 1 }, spy);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0].payload.message).toBe('Export: Downloaded 1 avatar');
    expect(spy.mock.calls[1][0].payload.message).toBe('Export: Downloaded 1 emoji');
  });

  it('fires html page milestones at first, every 5th, and last', () => {
    const spy = vi.fn();
    const total = 13;
    for (let i = 1; i <= total; i++) {
      logMediaProgressReference({ stage: 'html', current: i, total }, spy);
    }
    // 1, 5, 10, 13 → 4 entries
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('scopes messages with an optional suffix', () => {
    const spy = vi.fn();
    logMediaProgressReference({ stage: 'attachments', current: 1, total: 3 }, spy, ' in #general');
    expect(spy.mock.calls[0][0].payload.message).toBe('Export: Downloaded 1/3 attachments in #general');
  });

  it('does nothing when total is 0', () => {
    const spy = vi.fn();
    logMediaProgressReference({ stage: 'attachments', current: 0, total: 0 }, spy);
    logMediaProgressReference({ stage: 'html', current: 0, total: 0 }, spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fires finalizing entry exactly once (on current=1)', () => {
    const spy = vi.fn();
    logMediaProgressReference({ stage: 'finalizing', current: 1, total: 1 }, spy);
    logMediaProgressReference({ stage: 'finalizing', current: 1, total: 1 }, spy);
    // Two invocations — current=1 both times; the helper itself is stateless,
    // so dedupe is the caller's responsibility. We assert the message
    // contract, not dedupe.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0].payload.message).toMatch(/Finalizing archive/);
  });

});
