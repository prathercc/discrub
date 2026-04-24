import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { EVENTS, STATUS } from 'react-joyride';
import type { Step } from 'react-joyride';
import appReducer from '@features/app/appSlice';
import { useTour } from './useTour';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

/**
 * Unit coverage for the Bug 3 fix — useTour's guard against missing
 * first-step targets and its TARGET_NOT_FOUND handling. These behaviors
 * prevent Joyride's orphan-overlay hostile UX on cold-boot-to-DM (and
 * any future flow where a tour target isn't mounted).
 */

vi.mock('@/extension/storage', () => {
  function adapter() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      getMany: vi.fn().mockResolvedValue([]),
      setMany: vi.fn().mockResolvedValue(undefined),
      entries: vi.fn().mockResolvedValue([]),
    };
  }
  return {
    storage: {
      settings: adapter(), state: adapter(), presets: adapter(),
      cache: adapter(), history: adapter(), statuslog: adapter(),
      package: adapter(), media: adapter(),
    },
    migrateAllStorage: vi.fn().mockResolvedValue(undefined),
  };
});

function makeStore() {
  const store = configureStore({
    reducer: { app: appReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  // Populate settings so updateSetting's pending reducer's optimistic
  // update actually fires (it bails out when state.settings is null).
  store.dispatch({ type: 'app/setSettings', payload: {} });
  return store;
}

function wrapper(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

const STEP_IN_DOM: Step = {
  target: '#tour-target',
  title: 'Present',
  content: 'This target exists in the DOM',
};

const STEP_NOT_IN_DOM: Step = {
  target: '#nope-this-does-not-exist',
  title: 'Missing',
  content: 'This target is not rendered',
};

describe('useTour — Bug 3 guards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'tour-target';
    document.body.appendChild(el);
  });

  it('start() returns true and sets running=true when target exists', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useTour('contextual', { steps: [STEP_IN_DOM] }),
      { wrapper: wrapper(store) },
    );
    let started = false;
    act(() => {
      started = result.current.start();
    });
    expect(started).toBe(true);
    expect(result.current.running).toBe(true);
  });

  it('start() returns false and leaves running=false when target is missing', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useTour('contextual', { steps: [STEP_NOT_IN_DOM] }),
      { wrapper: wrapper(store) },
    );
    let started = true;
    act(() => {
      started = result.current.start();
    });
    expect(started).toBe(false);
    expect(result.current.running).toBe(false);
  });

  it('start() marks the tour completed (with current version) when target is missing AND the option is set', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useTour('contextual', {
        steps: [STEP_NOT_IN_DOM],
        markCompletedOnMissingTarget: true,
      }),
      { wrapper: wrapper(store) },
    );
    act(() => {
      result.current.start();
    });
    const settings = store.getState().app.settings;
    // Stored value is the current contextual-tour version, not legacy 'true'.
    // See TOUR_VERSIONS in useTour.ts — bumped to '2' in the 2.0.2 refresh.
    expect(settings?.[DiscrubSetting.APP_TOUR_CONTEXTUAL_COMPLETED]).toBe('2');
  });

  it('start() does NOT mark completed when target is missing and option is off', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useTour('shell', { steps: [STEP_NOT_IN_DOM] }),
      { wrapper: wrapper(store) },
    );
    act(() => {
      result.current.start();
    });
    const settings = store.getState().app.settings;
    // Key either absent or not 'true'.
    expect(settings?.[DiscrubSetting.APP_TOUR_SHELL_COMPLETED]).not.toBe('true');
  });

  it('handleEvent resets running state on TARGET_NOT_FOUND (mid-tour)', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useTour('contextual', { steps: [STEP_IN_DOM] }),
      { wrapper: wrapper(store) },
    );
    act(() => {
      result.current.start();
    });
    expect(result.current.running).toBe(true);

    act(() => {
      result.current.handleEvent(
        {
          type: EVENTS.TARGET_NOT_FOUND,
          action: 'update',
          index: 1,
          status: STATUS.RUNNING,
          step: STEP_NOT_IN_DOM,
          size: 2,
          lifecycle: 'tooltip',
        } as never,
        {} as never,
      );
    });
    expect(result.current.running).toBe(false);
  });

  it('start() with no steps provided runs unconditionally (back-compat)', () => {
    const store = makeStore();
    const { result } = renderHook(() => useTour('contextual'), { wrapper: wrapper(store) });
    let started = false;
    act(() => {
      started = result.current.start();
    });
    expect(started).toBe(true);
    expect(result.current.running).toBe(true);
  });
});

/**
 * Version-aware completion (2.0.2 refresh). Bumping a tour's version
 * should re-trigger it for users who finished the previous version,
 * without forcing brand-new users into the tour twice.
 */
describe('useTour — version-aware completion', () => {
  it('treats legacy "true" stored value as not-completed (forces refresh once)', () => {
    const store = makeStore();
    store.dispatch({
      type: 'app/setSettings',
      payload: { [DiscrubSetting.APP_TOUR_CONTEXTUAL_COMPLETED]: 'true' },
    });
    const { result } = renderHook(() => useTour('contextual'), { wrapper: wrapper(store) });
    expect(result.current.completed).toBe(false);
  });

  it('treats matching current-version stored value as completed (skips refresh)', () => {
    const store = makeStore();
    store.dispatch({
      type: 'app/setSettings',
      payload: { [DiscrubSetting.APP_TOUR_CONTEXTUAL_COMPLETED]: '2' },
    });
    const { result } = renderHook(() => useTour('contextual'), { wrapper: wrapper(store) });
    expect(result.current.completed).toBe(true);
  });

  it('treats absent stored value as not-completed (new user)', () => {
    const store = makeStore();
    const { result } = renderHook(() => useTour('contextual'), { wrapper: wrapper(store) });
    expect(result.current.completed).toBe(false);
  });
});
