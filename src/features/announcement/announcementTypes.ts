import type { AnnouncementArchiveEntry } from 'discrub-core/types/discrub-types';

export interface AnnouncementState {
  rev: string | null;
  markdown: string | null;
  isLoading: boolean;
  isLoadingMarkdown: boolean;
  markdownError: string | null;
  hasNew: boolean;
  dismissed: boolean;
  /** Past announcements, newest first; null until fetched (session cache). */
  archive: AnnouncementArchiveEntry[] | null;
  isLoadingArchive: boolean;
  archiveError: string | null;
  /** Archived version shown in the dialog; null = the live announcement. */
  selectedVersion: string | null;
}

export const initialAnnouncementState: AnnouncementState = {
  rev: null,
  markdown: null,
  isLoading: false,
  isLoadingMarkdown: false,
  markdownError: null,
  hasNew: false,
  dismissed: false,
  archive: null,
  isLoadingArchive: false,
  archiveError: null,
  selectedVersion: null,
};
