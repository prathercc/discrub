import { useState, useCallback } from 'react';
import { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { EventData, Controls, Step } from 'react-joyride';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { selectSetting, updateSetting } from '@features/app/appSlice';

type TourPhase = 'shell' | 'contextual';

/**
 * Per-phase tour version. Bumped whenever a phase's step list or copy
 * changes meaningfully so already-finished users see the refresh once.
 * Stored under the existing DiscrubSetting key — completion is now a
 * version string match, not the legacy 'true' boolean. Old 'true'
 * values are treated as not-completed so users who finished v1 see v2.
 *
 * - shell: still v1; the welcome-shell tour hasn't been refreshed
 * - contextual: bumped to v2 in 2.0.2 — added Author Actions step
 *   (#129), Focus mode step, restored message-feed anchor (the old
 *   message-table anchor was dead since #111), refreshed Filters copy
 */
export const TOUR_VERSIONS: Record<TourPhase, string> = {
  shell: '1',
  contextual: '2',
};

interface UseTourOptions {
  /**
   * If true and the tour's first-step target is missing from the DOM
   * when `start()` is called, mark the tour as completed so it stops
   * retrying across sessions instead of silently burning attempts
   * every page load. Default false (caller decides what to do).
   */
  markCompletedOnMissingTarget?: boolean;
  /**
   * The step list the tour will render. Used at `start()` time to
   * validate that the first step's target is in the DOM — without
   * this guard, a missing target produces Joyride's "orphan gray
   * overlay" hostile UI with no user escape hatch.
   */
  steps?: Step[];
}

export const useTour = (phase: TourPhase, options: UseTourOptions = {}) => {
  const { markCompletedOnMissingTarget = false, steps } = options;
  const dispatch = useAppDispatch();
  const settingKey = phase === 'shell'
    ? DiscrubSetting.APP_TOUR_SHELL_COMPLETED
    : DiscrubSetting.APP_TOUR_CONTEXTUAL_COMPLETED;

  const currentVersion = TOUR_VERSIONS[phase];
  const stored = useAppSelector(selectSetting(settingKey));
  // Completion is "stored value matches the current version". Legacy
  // 'true' values from before the version bump are treated as not-
  // completed so old users see the refreshed tour once.
  const completed = stored === currentVersion;
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  /**
   * Returns true if the tour actually started, false if the first-step
   * target was missing. Callers can distinguish between "tour running"
   * and "skipped due to missing DOM" without peeking at internal state.
   */
  const start = useCallback((): boolean => {
    const firstStep = steps?.[0];
    if (firstStep && typeof firstStep.target === 'string') {
      const selector = firstStep.target;
      // Only probe DOM when we have a selector we can check. Element
      // targets (ref-based) are passed through as-is.
      if (!document.querySelector(selector)) {
        if (markCompletedOnMissingTarget) {
          dispatch(updateSetting({ key: settingKey, value: currentVersion }));
        }
        return false;
      }
    }
    setStepIndex(0);
    setRunning(true);
    return true;
  }, [dispatch, markCompletedOnMissingTarget, settingKey, steps, currentVersion]);

  const handleEvent = useCallback((data: EventData, _controls: Controls) => {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }
    }

    // Joyride fires TARGET_NOT_FOUND when a mid-tour step's target
    // has disappeared (e.g., user navigated). Without this handler,
    // the tour stalls and leaves the overlay visible with no way out.
    if (type === EVENTS.TARGET_NOT_FOUND) {
      setRunning(false);
      setStepIndex(0);
      return;
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunning(false);
      setStepIndex(0);
      dispatch(updateSetting({ key: settingKey, value: currentVersion }));
    }

    if (action === ACTIONS.CLOSE) {
      setRunning(false);
      setStepIndex(0);
    }
  }, [dispatch, settingKey, currentVersion]);

  return { running, stepIndex, completed, start, handleEvent };
};
