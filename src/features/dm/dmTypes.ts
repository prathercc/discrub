import type { Channel } from 'discrub-core/types/discord-types';

/**
 * Types for DM feature
 */

export interface DmState {
  dms: Channel[];
  selectedDm: Channel | null;
  selectedDms: Channel[];
  isLoading: boolean;
  error: string | null;
}

export const initialDmState: DmState = {
  dms: [],
  selectedDm: null,
  selectedDms: [],
  isLoading: false,
  error: null,
};
