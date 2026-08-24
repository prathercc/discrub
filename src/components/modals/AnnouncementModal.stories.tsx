import type { Meta, StoryObj } from '@storybook/react';
import AnnouncementModal from './AnnouncementModal';

const meta: Meta<typeof AnnouncementModal> = {
  title: 'Modals/AnnouncementModal',
  component: AnnouncementModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '400px' } },
  },
};
export default meta;

type Story = StoryObj<typeof AnnouncementModal>;

export const WithContent: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: 'Welcome to Discrub v2.0!\n\nNew features include:\n- Bulk export for server channels and DMs\n- Mention analytics\n- Purge operations\n- And much more!',
  },
};

const ARCHIVE = [
  { version: '2.1.0', date: '2026-08-23', title: 'Discrub 2.1.0', markdown: "# What's New in Discrub 2.1.0\n\nThemes, supporter themes, and a phone layout." },
  { version: '2.0.10', date: '2026-08-16', title: 'Discrub 2.0.10', markdown: "# What's New in Discrub 2.0.10\n\nToken login fix." },
  { version: '2.0.9', date: '2026-08-15', title: 'Discrub 2.0.9', markdown: "# What's New in Discrub 2.0.9" },
];

export const WithVersionRail: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    onSelectVersion: () => {},
    markdown: "# What's New in Discrub 2.1.0\n\nThe live announcement, folded into its archive row.",
    archive: ARCHIVE,
  },
};

export const ViewingOlderVersion: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    onSelectVersion: () => {},
    markdown: "# What's New in Discrub 2.1.0\n\nLive.",
    archive: ARCHIVE,
    selectedVersion: '2.0.10',
  },
};

export const ArchiveUnavailable: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: 'Live announcement; the archive could not be loaded.',
    archive: null,
    archiveError: 'No previous announcements are available right now',
  },
};

export const ShortMessage: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: 'Minor bug fix release.',
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onDismiss: () => {},
    markdown: 'This should not be visible.',
  },
};

export const NullMarkdown: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: null,
  },
};
