import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchAnnouncementData,
  fetchAnnouncementMarkdown,
  fetchAnnouncementArchive,
} from 'discrub-core/github-service';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { initialAnnouncementState } from './announcementTypes';
import type { RootState } from '@/app/store';
import type { AnnouncementArchiveEntry } from 'discrub-core/types/discrub-types';
import { selectSettings, updateSetting } from '@features/app/appSlice';
import { defaultSettings } from '@features/app/storageKeys';

/**
 * Fetch announcement data and markdown from GitHub gist
 */
export const fetchAnnouncement = createAsyncThunk(
  'announcement/fetchAnnouncement',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const settings = selectSettings(state);
      // Caller is responsible for waiting until settings have loaded.
      // If they fire this thunk while settings is still null (e.g. a
      // race against loadSettings on cold boot), the cached rev would
      // be misread and a previously-dismissed announcement could pop
      // back up. Fail closed: skip the check until settings exist.
      if (!settings) {
        return rejectWithValue('Settings not loaded yet — try again');
      }
      // Settings can also be PARTIAL during boot if a `updateSetting`
      // landed before `loadSettings.fulfilled` (the dispatch in
      // openDonationDrawer cypress helper, for example). Fall back to
      // the default rev when the key is missing so a partial-state
      // race doesn't manifest as cachedRev='' → "new announcement".
      const cachedRev =
        settings[DiscrubSetting.CACHED_ANNOUNCEMENT_REV] ??
        defaultSettings[DiscrubSetting.CACHED_ANNOUNCEMENT_REV] ??
        '';

      const announcementData = await fetchAnnouncementData();
      const currentRev = announcementData.rev;
      const hasNew = currentRev !== cachedRev;

      // Only fetch markdown if there's a new announcement (auto-show modal)
      // Otherwise, markdown is fetched lazily when user clicks re-view button
      const markdown = hasNew ? await fetchAnnouncementMarkdown() : null;

      return { rev: currentRev, markdown, hasNew };
    } catch {
      return rejectWithValue('Failed to fetch announcement');
    }
  }
);

/**
 * Lazily fetch announcement markdown (for re-view button)
 */
export const fetchAnnouncementMarkdownThunk = createAsyncThunk(
  'announcement/fetchMarkdown',
  async (_, { rejectWithValue }) => {
    try {
      const markdown = await fetchAnnouncementMarkdown();
      return markdown || '';
    } catch {
      return rejectWithValue('Failed to fetch announcement content');
    }
  }
);

/**
 * Load the past-announcements archive for the dialog's version rail. One gist
 * request, cached in the slice for the session; later opens reuse it. Called
 * whenever the dialog opens (auto-show or View Announcement).
 */
export const fetchAnnouncementArchiveThunk = createAsyncThunk<
  AnnouncementArchiveEntry[],
  void,
  { state: RootState }
>(
  'announcement/fetchArchive',
  async (_, { getState, rejectWithValue }) => {
    const cached = getState().announcement.archive;
    if (cached && cached.length > 0) return cached;
    try {
      const entries = await fetchAnnouncementArchive();
      if (entries.length === 0) return rejectWithValue('No previous announcements are available right now');
      return entries;
    } catch {
      return rejectWithValue('Failed to load previous announcements');
    }
  },
  {
    condition: (_, { getState }) => {
      const { archive, isLoadingArchive } = getState().announcement;
      return !isLoadingArchive && !(archive && archive.length > 0);
    },
  }
);

/**
 * Dismiss announcement and cache the revision
 */
export const dismissAnnouncement = createAsyncThunk(
  'announcement/dismissAnnouncement',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const rev = state.announcement.rev;
    if (rev) {
      await dispatch(updateSetting({ key: DiscrubSetting.CACHED_ANNOUNCEMENT_REV, value: rev }));
    }
  }
);

const announcementSlice = createSlice({
  name: 'announcement',
  initialState: initialAnnouncementState,
  reducers: {
    reopenAnnouncement: (state) => {
      state.hasNew = true;
    },
    /** Pick an archived version to show, or null for the live announcement. */
    selectArchiveVersion: (state, action: { payload: string | null }) => {
      if (action.payload === null || state.archive?.some((entry) => entry.version === action.payload)) {
        state.selectedVersion = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnnouncement.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAnnouncement.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rev = action.payload.rev;
        // The boot fetch can resolve after the user already reopened the
        // dialog from the More menu (hasNew=true, markdown fetched lazily).
        // A "nothing new" result must not close that dialog or wipe its
        // content, so only ever raise hasNew here and keep existing markdown.
        if (action.payload.markdown !== null) state.markdown = action.payload.markdown;
        state.hasNew = state.hasNew || action.payload.hasNew;
      })
      .addCase(fetchAnnouncement.rejected, (state) => {
        state.isLoading = false;
        state.hasNew = false;
      })
      .addCase(dismissAnnouncement.fulfilled, (state) => {
        state.hasNew = false;
        state.dismissed = true;
        // Leave the archive cached; the next open starts on the live announcement again.
        state.selectedVersion = null;
      })
      .addCase(fetchAnnouncementArchiveThunk.pending, (state) => {
        state.isLoadingArchive = true;
        state.archiveError = null;
      })
      .addCase(fetchAnnouncementArchiveThunk.fulfilled, (state, action) => {
        state.isLoadingArchive = false;
        state.archive = action.payload;
      })
      .addCase(fetchAnnouncementArchiveThunk.rejected, (state, action) => {
        state.isLoadingArchive = false;
        state.archiveError = (action.payload as string | undefined) ?? 'Failed to load previous announcements';
      })
      .addCase(fetchAnnouncementMarkdownThunk.pending, (state) => {
        state.isLoadingMarkdown = true;
        state.markdownError = null;
      })
      .addCase(fetchAnnouncementMarkdownThunk.fulfilled, (state, action) => {
        state.isLoadingMarkdown = false;
        state.markdown = action.payload;
      })
      .addCase(fetchAnnouncementMarkdownThunk.rejected, (state) => {
        state.isLoadingMarkdown = false;
        state.markdownError = 'Failed to load announcement content';
      });
  },
});

export const { reopenAnnouncement, selectArchiveVersion } = announcementSlice.actions;

export const selectAnnouncement = (state: RootState) => state.announcement;
export const selectHasNewAnnouncement = (state: RootState) => state.announcement.hasNew;
export const selectAnnouncementMarkdown = (state: RootState) => state.announcement.markdown;
export const selectIsLoadingMarkdown = (state: RootState) => state.announcement.isLoadingMarkdown;
export const selectMarkdownError = (state: RootState) => state.announcement.markdownError;
export const selectAnnouncementArchive = (state: RootState) => state.announcement.archive;
export const selectIsLoadingArchive = (state: RootState) => state.announcement.isLoadingArchive;
export const selectArchiveError = (state: RootState) => state.announcement.archiveError;
export const selectSelectedArchiveVersion = (state: RootState) => state.announcement.selectedVersion;

export default announcementSlice.reducer;
