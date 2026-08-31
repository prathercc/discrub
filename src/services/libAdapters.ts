import type { RootState } from '@/app/store';
import type {
  IModificationProgressManager,
  INotificationManager,
  ShouldStopCallback,
} from 'discrub-core/messages';
import { selectDiscrubPaused, selectDiscrubCancelled } from '@features/app/appSlice';
import { addStatusEntry } from '@features/status/statusSlice';
import { throttleImmuneSleep } from '@/utils/workerTimers';

/**
 * Creates a ShouldStopCallback that bridges discrub-core's pause/cancel
 * mechanism to Redux state. When paused, the returned promise won't
 * resolve until unpaused (or cancelled). Returns true when cancelled.
 */
export const createShouldStop = (
  getState: () => RootState,
): ShouldStopCallback => {
  return async () => {
    while (selectDiscrubPaused(getState())) {
      await throttleImmuneSleep(200);
      if (selectDiscrubCancelled(getState())) return true;
    }
    return selectDiscrubCancelled(getState());
  };
};

/**
 * Creates an IModificationProgressManager that dispatches Redux actions
 * to track modification progress in the status log.
 */
export const createProgressManager = (
  _dispatch: (action: any) => void,
): IModificationProgressManager => ({
  setIsModifying(_isModifying: boolean) {
    // Intentionally empty — modification entries removed from status log
  },
  setModifyEntity(_entity: any) {
    // Intentionally empty — entity processing entries removed from status log
  },
});

/**
 * Creates an INotificationManager that dispatches status log entries
 * for operation notifications (e.g., rate-limit delays).
 */
export const createNotificationManager = (
  dispatch: (action: any) => void,
): INotificationManager => ({
  async notify(message: string, _timeout: number) {
    dispatch(addStatusEntry({ level: 'info', message }));
  },
});
