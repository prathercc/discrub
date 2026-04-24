import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';
import appReducer, { settingsChangeMiddleware } from '@features/app/appSlice';
import { errorLoggingMiddleware } from '@/middleware/errorLoggingMiddleware';
import guildReducer from '@features/guild/guildSlice';
import channelReducer from '@features/channel/channelSlice';
import dmReducer from '@features/dm/dmSlice';
import messageReducer from '@features/message/messageSlice';
import exportReducer from '@features/export/exportSlice';
import cacheReducer from '@features/cache/cacheSlice';
import statusReducer from '@features/status/statusSlice';
import purgeReducer from '@features/purge/purgeSlice';
import announcementReducer from '@features/announcement/announcementSlice';
import presetsReducer from '@features/presets/presetsSlice';
import historyReducer from '@features/history/historySlice';
import packageReducer from '@features/package/packageSlice';

/**
 * Redux store configuration
 * Combines all feature slices and provides typed hooks
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    app: appReducer,
    guild: guildReducer,
    channel: channelReducer,
    dm: dmReducer,
    message: messageReducer,
    export: exportReducer,
    cache: cacheReducer,
    status: statusReducer,
    purge: purgeReducer,
    announcement: announcementReducer,
    presets: presetsReducer,
    history: historyReducer,
    package: packageReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these paths in the state for serializability checks
        // This is useful for storing Date objects or other non-serializable data
        ignoredActions: ['auth/setToken'],
        ignoredPaths: ['auth.token'],
      },
    }).concat(settingsChangeMiddleware, errorLoggingMiddleware),
});

export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
