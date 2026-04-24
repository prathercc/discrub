import type { Meta, StoryObj } from '@storybook/react';
import AttachmentModal from './AttachmentModal';

const meta: Meta<typeof AttachmentModal> = {
  title: 'Modals/AttachmentModal',
  component: AttachmentModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '500px' } },
  },
};
export default meta;

type Story = StoryObj<typeof AttachmentModal>;

const mockMessage = {
  id: 'msg-1',
  content: 'Check out this image',
  author: { id: 'u1', username: 'testuser', discriminator: '0001', avatar: null },
  timestamp: '2024-01-15T10:00:00Z',
  attachments: [
    {
      id: 'att-1',
      filename: 'screenshot.png',
      size: 1024000,
      url: 'https://via.placeholder.com/800x600',
      proxy_url: 'https://via.placeholder.com/800x600',
      content_type: 'image/png',
      width: 800,
      height: 600,
    },
  ],
} as any;

export const ViewOnly: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    message: {
      ...mockMessage,
      attachments: [
        ...mockMessage.attachments,
        {
          id: 'att-2',
          filename: 'document.pdf',
          size: 512000,
          url: 'https://example.com/doc.pdf',
          proxy_url: 'https://example.com/doc.pdf',
          content_type: 'application/pdf',
        },
      ],
    },
    onClose: () => {},
    onDeleteAttachment: async () => {},
    onDeleteAllAttachments: async () => {},
  },
};

export const SingleAttachmentWarning: Story = {
  args: {
    open: true,
    message: {
      ...mockMessage,
      content: '', // No content — triggers warning
    },
    onClose: () => {},
    onDeleteAttachment: async () => {},
    onDeleteAllAttachments: async () => {},
  },
};

export const NoMessage: Story = {
  args: {
    open: true,
    message: null,
    onClose: () => {},
  },
};

export const MultipleAttachments: Story = {
  args: {
    open: true,
    message: {
      ...mockMessage,
      attachments: [
        ...mockMessage.attachments,
        {
          id: 'att-2',
          filename: 'document.pdf',
          size: 512000,
          url: 'https://example.com/doc.pdf',
          proxy_url: 'https://example.com/doc.pdf',
          content_type: 'application/pdf',
        },
      ],
    },
    onClose: () => {},
  },
};

export const Deleting: Story = {
  args: {
    open: true,
    message: {
      ...mockMessage,
      attachments: [
        ...mockMessage.attachments,
        {
          id: 'att-2',
          filename: 'document.pdf',
          size: 512000,
          url: 'https://example.com/doc.pdf',
          proxy_url: 'https://example.com/doc.pdf',
          content_type: 'application/pdf',
        },
        {
          id: 'att-3',
          filename: 'video.mp4',
          size: 20480000,
          url: 'https://example.com/video.mp4',
          proxy_url: 'https://example.com/video.mp4',
          content_type: 'video/mp4',
        },
      ],
    },
    onClose: () => {},
    onDeleteAttachment: () => new Promise(() => {}),
    onDeleteAllAttachments: () => new Promise(() => {}),
  },
};
