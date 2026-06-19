// #195 cluster B: MediaMaps, ExportConfig, TextFormatOptions and friends
// were promoted to discrub-core/types/export-types since they're pure
// emitter knobs consumed by lib-side text/html emitters. Re-exported here
// so callers can keep their existing import paths.
import { defaultTextFormatOptions } from 'discrub-core/types/export-types';
// `export type { ... } from` re-exports without creating a local binding, so
// TextFormatOptions wasn't usable as a type annotation in this file (TS2304).
// Import it locally for the annotations below; the re-export still serves
// downstream callers.
import type { TextFormatOptions } from 'discrub-core/types/export-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
export type {
  MediaMaps,
  ExportConfig,
  TextAttachmentStyle,
  TextReactionsStyle,
  TextRepliesStyle,
  TextBotIndicatorStyle,
  TextFormatOptions,
} from 'discrub-core/types/export-types';
export { defaultTextFormatOptions };

export interface MediaDownloadProgress {
  stage: 'avatars' | 'attachments' | 'emojis' | 'roles' | 'html' | 'finalizing';
  current: number;
  total: number;
  message?: string;
}

export interface MediaConfig {
  images: boolean;
  videos: boolean;
  audio: boolean;
  other: boolean;
}

export type ExportFormat = 'html' | 'csv' | 'json' | 'media' | 'text';
export type ExportTemplate = 'standard' | 'discord';

export interface BulkContext {
  currentIndex: number;
  totalChannels: number;
  currentChannelName: string;
}

export interface ExportProgress extends MediaDownloadProgress {
  bulk?: BulkContext;
}

/**
 * A persisted export date window (#207 Arm B). Stored as ISO strings so the
 * snapshot stays serializable in preset/history storage; converted back to
 * Date bounds on the export criteria when a preset is applied. `null` on a
 * side means that bound is open.
 */
export interface ExportDateRange {
  after: string | null;
  before: string | null;
}

/**
 * Snapshot of export settings — used by presets and recent export history
 */
export interface ExportSettingsSnapshot {
  format: ExportFormat;
  messagesPerPage: number;
  separateThreads: boolean;
  includeMedia: boolean;
  mediaConfig: MediaConfig;
  artistMode: boolean;
  sortOrder: 'ascending' | 'descending';
  previewMedia: boolean;
  textOptions?: TextFormatOptions;
  /**
   * Optional, opt-in (#207 Arm B). When a preset is saved with "include the
   * current date range" checked, the active export date window is captured
   * here so re-applying the preset restores it. Most presets omit this — they
   * reuse formatting without locking a date window. Not part of the
   * formatting-equality check, so it never drives the "modified" auto-clear.
   */
  dateRange?: ExportDateRange;
}

export type PresetCategory = 'Backup' | 'Data' | 'Media';

export const PRESET_CATEGORIES: PresetCategory[] = ['Backup', 'Data', 'Media'];

export interface ExportPreset extends ExportSettingsSnapshot {
  id: string;
  name: string;
  isBuiltIn: boolean;
  category?: PresetCategory;
}

export interface RecentExport {
  id: string;
  channelName: string;
  timestamp: string;
  isBulk: boolean;
  channelCount?: number;
  config: ExportSettingsSnapshot;
}

export const BUILT_IN_PRESETS: ExportPreset[] = [
  {
    id: 'builtin-quick-text',
    name: 'Quick text backup',
    isBuiltIn: true,
    category: 'Backup',
    format: 'html',
    messagesPerPage: 100,
    separateThreads: false,
    includeMedia: false,
    mediaConfig: { images: false, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'descending',
    previewMedia: true,

  },
  {
    id: 'builtin-full-archive',
    name: 'Full archive',
    isBuiltIn: true,
    category: 'Backup',
    format: 'html',
    messagesPerPage: 100,
    separateThreads: true,
    includeMedia: true,
    mediaConfig: { images: true, videos: true, audio: true, other: true },
    artistMode: false,
    sortOrder: 'descending',
    previewMedia: true,

  },
  {
    id: 'builtin-data-analysis',
    name: 'Data analysis',
    isBuiltIn: true,
    category: 'Data',
    format: 'json',
    messagesPerPage: 1000,
    separateThreads: false,
    includeMedia: false,
    mediaConfig: { images: false, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'ascending',
    previewMedia: false,

  },
  {
    id: 'builtin-spreadsheet',
    name: 'Spreadsheet export',
    isBuiltIn: true,
    category: 'Data',
    format: 'csv',
    messagesPerPage: 500,
    separateThreads: false,
    includeMedia: false,
    mediaConfig: { images: false, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'ascending',
    previewMedia: false,

  },
  {
    id: 'builtin-media-gallery',
    name: 'Media gallery',
    isBuiltIn: true,
    category: 'Media',
    format: 'media',
    messagesPerPage: 100,
    separateThreads: false,
    includeMedia: true,
    mediaConfig: { images: true, videos: true, audio: true, other: true },
    artistMode: true,
    sortOrder: 'descending',
    previewMedia: true,

  },
  {
    id: 'builtin-lightweight',
    name: 'Lightweight backup',
    isBuiltIn: true,
    category: 'Backup',
    format: 'html',
    messagesPerPage: 50,
    separateThreads: false,
    includeMedia: true,
    mediaConfig: { images: true, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'descending',
    previewMedia: true,

  },
  {
    id: 'builtin-chronological',
    name: 'Chronological log',
    isBuiltIn: true,
    category: 'Backup',
    format: 'html',
    messagesPerPage: 500,
    separateThreads: false,
    includeMedia: false,
    mediaConfig: { images: false, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'ascending',
    previewMedia: false,

  },
  {
    id: 'builtin-images-only',
    name: 'Images only',
    isBuiltIn: true,
    category: 'Media',
    format: 'media',
    messagesPerPage: 100,
    separateThreads: false,
    includeMedia: true,
    mediaConfig: { images: true, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'descending',
    previewMedia: true,

  },
  {
    id: 'builtin-thread-archive',
    name: 'Thread archive',
    isBuiltIn: true,
    category: 'Backup',
    format: 'html',
    messagesPerPage: 50,
    separateThreads: true,
    includeMedia: true,
    mediaConfig: { images: true, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'descending',
    previewMedia: true,

  },
  {
    id: 'builtin-plain-text',
    name: 'Plain text',
    isBuiltIn: true,
    category: 'Backup',
    format: 'text',
    messagesPerPage: 500,
    separateThreads: false,
    includeMedia: false,
    mediaConfig: { images: false, videos: false, audio: false, other: false },
    artistMode: false,
    sortOrder: 'descending',
    previewMedia: false,
    textOptions: { ...defaultTextFormatOptions },
  },
];

export interface ExportState {
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportTotal: number;
  currentPage: number;
  totalPages: number;
  exportError: string | null;
  exportFormat: ExportFormat;
  messagesPerPage: number;
  separateThreads: boolean;
  includeMedia: boolean;
  mediaConfig: MediaConfig;
  artistMode: boolean;
  sortOrder: 'ascending' | 'descending';
  previewMedia: boolean;
  exportTemplate: ExportTemplate;
  textOptions: TextFormatOptions;
  /**
   * The active export filter/date window (#207 Arm B). Lifted out of
   * BulkExportDialog's transient local state into the slice so a preset's
   * saved date range can be restored into it on apply. Holds Date bounds like
   * message.searchCriteria; the path is serializability-ignored in the store.
   */
  exportCriteria: SearchCriteria | null;
}

export const initialExportState: ExportState = {
  isExporting: false,
  exportProgress: null,
  exportTotal: 0,
  currentPage: 0,
  totalPages: 0,
  exportError: null,
  exportFormat: 'html',
  messagesPerPage: 100,
  separateThreads: false,
  includeMedia: true,
  mediaConfig: {
    images: true,
    videos: true,
    audio: true,
    other: true,
  },
  artistMode: false,
  sortOrder: 'descending',
  previewMedia: true,
  exportTemplate: 'discord',
  textOptions: { ...defaultTextFormatOptions },
  exportCriteria: null,
};
