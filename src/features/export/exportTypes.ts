export interface MediaDownloadProgress {
  stage: 'avatars' | 'attachments' | 'emojis' | 'roles' | 'html' | 'finalizing';
  current: number;
  total: number;
  message?: string;
}

export interface MediaMaps {
  avatarMap: Record<string, string>;
  mediaMap: Record<string, string>;
  emojiMap: Record<string, string>;
  roleMap: Record<string, string>;
}

export interface MediaConfig {
  images: boolean;
  videos: boolean;
  audio: boolean;
  other: boolean;
}

export type ExportFormat = 'html' | 'csv' | 'json' | 'media';
export type ExportTemplate = 'standard' | 'discord';

export interface ExportConfig {
  artistMode: boolean;
  sortOrder: 'ascending' | 'descending';
  previewMedia: boolean;
  dateFormat: string;
  timeFormat: string;
  exportTemplate?: ExportTemplate;
}

export interface BulkContext {
  currentIndex: number;
  totalChannels: number;
  currentChannelName: string;
}

export interface ExportProgress extends MediaDownloadProgress {
  bulk?: BulkContext;
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
};
