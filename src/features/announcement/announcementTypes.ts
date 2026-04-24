export interface AnnouncementState {
  rev: string | null;
  markdown: string | null;
  isLoading: boolean;
  isLoadingMarkdown: boolean;
  markdownError: string | null;
  hasNew: boolean;
  dismissed: boolean;
}

export const initialAnnouncementState: AnnouncementState = {
  rev: null,
  markdown: null,
  isLoading: false,
  isLoadingMarkdown: false,
  markdownError: null,
  hasNew: false,
  dismissed: false,
};
