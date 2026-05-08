import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { initialDevState, type DevState, type SeedProgress, type SeedVarietyOptions } from './devTypes';
import {
  CancelledError,
  cancellableDelay,
  checkCancelled,
  waitWhilePaused,
} from '@/utils/operationLoopUtils';
import { calculateRandomDelay } from '@/utils/delayUtils';
import { selectDeleteDelay, selectDelayModifier, setDiscrubCancelled } from '@features/app/appSlice';
import { addStatusEntry } from '@features/status/statusSlice';
import { getDiscordService } from '@/services/discordService';
import type { MessageCreate } from 'discrub-core/types/discord-types';
import {
  generateMessageContent,
  randomReactionEmoji,
} from './seedContent';

const HARD_CAP_PER_CHANNEL = 100;

interface SeedThunkArg {
  channels: Array<{ id: string; name: string }>;
  countPerChannel: number;
  options: SeedVarietyOptions;
  rng?: () => number;
}

/**
 * Seed test messages in one or more channels (#153). Sequential
 * channel-by-channel so per-channel rate limits never compound, and
 * so pause/cancel reads naturally on the per-message delay. The
 * delay matches `DELETE_DELAY` because the same "be polite to the
 * Discord API" rationale applies; reusing the existing setting keeps
 * the seeder out of user-visible Settings.
 */
export const seedChannelMessages = createAsyncThunk<
  { posted: number; errored: number; cancelled: boolean },
  SeedThunkArg,
  { state: RootState }
>(
  'dev/seedChannelMessages',
  async ({ channels, countPerChannel, options, rng }, { getState, dispatch, rejectWithValue }) => {
    const state = getState();
    const token = state.auth.token;
    const selfUserId = state.user.currentUser?.id ?? null;
    if (!token) return rejectWithValue('Not authenticated');
    if (!selfUserId) return rejectWithValue('No user context');
    if (channels.length === 0) return rejectWithValue('No channels selected');

    const cap = Math.min(Math.max(1, countPerChannel), HARD_CAP_PER_CHANNEL);
    const random = rng ?? Math.random;
    const deleteDelay = selectDeleteDelay(state);
    const delayModifier = selectDelayModifier(state);

    const discordService = getDiscordService();
    let posted = 0;
    let errored = 0;
    let cancelled = false;

    dispatch(setDiscrubCancelled(false));
    dispatch(addStatusEntry({
      level: 'info',
      message:
        `Seeding ${cap.toLocaleString()} ${cap === 1 ? 'message' : 'messages'} ` +
        `in ${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}.`,
    }));

    // Per-channel posted IDs let later messages reply to earlier ones
    // within the same channel run. Keeps the cross-channel structure
    // clean (replies stay scoped to the channel they originate in).

    try {
      for (let chIdx = 0; chIdx < channels.length; chIdx++) {
        const ch = channels[chIdx];
        const postedInChannel: string[] = [];

        dispatch(addStatusEntry({
          level: 'info',
          message: `Seeding "#${ch.name}" (channel ${chIdx + 1}/${channels.length}).`,
        }));

        for (let i = 0; i < cap; i++) {
          await waitWhilePaused(getState);
          if (checkCancelled(getState)) throw new CancelledError();

          const progress: SeedProgress = {
            channelIndex: chIdx,
            totalChannels: channels.length,
            currentChannelName: ch.name,
            current: i,
            total: cap,
            totalPosted: posted,
            totalErrors: errored,
          };
          dispatch(setSeedProgress(progress));

          // Decide if this message should be a reply to a prior post
          // in the same channel. ~20% chance once we have something
          // to reply to.
          const replyTarget =
            options.includeReplies && postedInChannel.length > 0 && random() < 0.2
              ? postedInChannel[Math.floor(random() * postedInChannel.length)]
              : null;

          const content = generateMessageContent(
            { includeMentions: options.includeMentions, selfUserId },
            random,
          );

          const body: MessageCreate = { content };
          if (replyTarget) {
            body.message_reference = {
              message_id: replyTarget,
              channel_id: ch.id,
              fail_if_not_exists: false,
            };
          }

          const result = await discordService.postMessage(token, ch.id, body);
          if (!result.success || !result.data) {
            errored++;
            dispatch(addStatusEntry({
              level: 'error',
              message:
                `Couldn't post message ${i + 1} in "#${ch.name}" ` +
                `(HTTP ${result.status || 'network'}).`,
            }));
          } else {
            posted++;
            postedInChannel.push(result.data.id);

            // Side effects: reaction / edit / pin. Each adds an extra
            // API call with the same delay before it. Distribute so
            // not every message gets every effect. editMessage applies
            // its own withDelay("delete") inside discrub-core so we
            // skip our external delay before that one specifically.
            if (options.includeReactions && random() < 0.3) {
              await postMessageDelay(deleteDelay, delayModifier, getState);
              await discordService.addReaction(
                token,
                ch.id,
                result.data.id,
                randomReactionEmoji(random),
              );
            }
            if (options.includeEdits && random() < 0.15) {
              await discordService.editMessage(
                token,
                result.data.id,
                { content: `${content} (edited)` },
                ch.id,
              );
            }
            if (options.includePins && random() < 0.05) {
              await postMessageDelay(deleteDelay, delayModifier, getState);
              await discordService.pinMessage(token, ch.id, result.data.id);
              // Pin failures are normal (50/channel cap, missing
              // perms) — silent so the run keeps moving.
            }
          }

          // Delay between message posts unless we're on the last one
          // of the last channel.
          const isLast = chIdx === channels.length - 1 && i === cap - 1;
          if (!isLast) {
            await postMessageDelay(deleteDelay, delayModifier, getState);
          }
        }

        dispatch(addStatusEntry({
          level: 'success',
          message:
            `Seeded "#${ch.name}": ${postedInChannel.length} posted` +
            (errored > 0 ? `, ${errored} errored so far.` : '.'),
        }));
      }
    } catch (err) {
      if (err instanceof CancelledError) {
        cancelled = true;
      } else {
        dispatch(addStatusEntry({
          level: 'error',
          message: `Seeding stopped: ${err instanceof Error ? err.message : 'unknown error'}.`,
        }));
      }
    }

    dispatch(addStatusEntry({
      level: errored > 0 ? 'warning' : 'success',
      message:
        `Seeding complete. Posted ${posted}` +
        (errored > 0 ? `, ${errored} errored` : '') +
        (cancelled ? ' (cancelled).' : '.'),
    }));

    return { posted, errored, cancelled };
  },
);

async function postMessageDelay(
  base: number,
  modifier: number,
  getState: () => RootState,
): Promise<void> {
  const calc = calculateRandomDelay(base, modifier);
  const wasCancelled = await cancellableDelay(calc.delayMs, getState);
  if (wasCancelled) throw new CancelledError();
}

const devSlice = createSlice({
  name: 'dev',
  initialState: initialDevState,
  reducers: {
    setSeedProgress(state, action: PayloadAction<SeedProgress>) {
      state.seedProgress = action.payload;
    },
    clearSeedError(state) {
      state.seedError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(seedChannelMessages.pending, (state) => {
        state.isSeeding = true;
        state.seedError = null;
        state.seedProgress = null;
      })
      .addCase(seedChannelMessages.fulfilled, (state) => {
        state.isSeeding = false;
        state.seedProgress = null;
      })
      .addCase(seedChannelMessages.rejected, (state, action) => {
        state.isSeeding = false;
        state.seedError = (action.payload as string) || action.error.message || 'Seeding failed';
        state.seedProgress = null;
      });
  },
});

export const { setSeedProgress, clearSeedError } = devSlice.actions;
export default devSlice.reducer;

export const selectIsSeeding = (state: RootState): boolean => state.dev.isSeeding;
export const selectSeedProgress = (state: RootState): SeedProgress | null => state.dev.seedProgress;
export const selectSeedError = (state: RootState): string | null => state.dev.seedError;

export type { DevState };
