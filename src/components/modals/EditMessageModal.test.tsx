import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditMessageModal from './EditMessageModal';
import { createMockMessage, createMockAttachment } from '../../test/fixtures';

describe('EditMessageModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    message: createMockMessage({ content: 'Hello world' }),
    messageCount: 1,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the dialog title', () => {
      render(<EditMessageModal {...defaultProps} />);
      expect(screen.getByText('Edit Message')).toBeInTheDocument();
    });

    it('should render the text field with label', () => {
      render(<EditMessageModal {...defaultProps} />);
      expect(screen.getByLabelText('Message Content')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<EditMessageModal {...defaultProps} open={false} />);
      expect(screen.queryByText('Edit Message')).toBeNull();
    });

    it('should render Cancel and Save buttons', () => {
      render(<EditMessageModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  describe('Content Population', () => {
    it('should populate text field with message content', () => {
      render(<EditMessageModal {...defaultProps} />);
      const textarea = screen.getByLabelText('Message Content') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Hello world');
    });

    it('should handle null message gracefully', () => {
      render(<EditMessageModal {...defaultProps} message={null} />);
      const textarea = screen.getByLabelText('Message Content') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('should handle message with empty content', () => {
      render(<EditMessageModal {...defaultProps} message={createMockMessage({ content: '' })} />);
      const textarea = screen.getByLabelText('Message Content') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });
  });

  describe('Save Validation', () => {
    it('should disable Save when content is empty and message has no attachments', () => {
      render(<EditMessageModal {...defaultProps} message={createMockMessage({ content: '' })} />);
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should disable Save when content is whitespace only and message has no attachments', () => {
      render(<EditMessageModal {...defaultProps} message={createMockMessage({ content: '   ' })} />);
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should show error when content is empty and message has no attachments', () => {
      render(<EditMessageModal {...defaultProps} message={createMockMessage({ content: '' })} />);
      expect(screen.getByText(/Discord requires non-empty content/)).toBeInTheDocument();
    });

    it('should enable Save when content is empty and message has attachments', () => {
      const msg = createMockMessage({ content: '', attachments: [createMockAttachment()] });
      render(<EditMessageModal {...defaultProps} message={msg} />);
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });

    it('should show warning when content is empty and message has attachments', () => {
      const msg = createMockMessage({ content: '', attachments: [createMockAttachment()] });
      render(<EditMessageModal {...defaultProps} message={msg} />);
      expect(screen.getByText(/Saving with empty content will clear message text/)).toBeInTheDocument();
    });

    it('should enable Save when content is non-empty', () => {
      render(<EditMessageModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('should call onSave with current content when Save is clicked', () => {
      const onSave = vi.fn();
      render(<EditMessageModal {...defaultProps} onSave={onSave} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSave).toHaveBeenCalledWith('Hello world');
    });

    it('should call onSave with updated content after editing', () => {
      const onSave = vi.fn();
      render(<EditMessageModal {...defaultProps} onSave={onSave} />);
      const textarea = screen.getByLabelText('Message Content');
      fireEvent.change(textarea, { target: { value: 'Updated content' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSave).toHaveBeenCalledWith('Updated content');
    });

    it('should call onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<EditMessageModal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bulk Mode (messageCount > 1)', () => {
    const bulkMessages = [
      createMockMessage({ id: 'a', attachments: [createMockAttachment()] }),
      createMockMessage({ id: 'b', attachments: [createMockAttachment()] }),
      createMockMessage({ id: 'c', attachments: [createMockAttachment()] }),
    ];
    const bulkProps = {
      ...defaultProps,
      message: null,
      messages: bulkMessages,
      messageCount: 3,
    };

    it('should show "Bulk Edit" title', () => {
      render(<EditMessageModal {...bulkProps} />);
      expect(screen.getByText('Bulk Edit')).toBeInTheDocument();
    });

    it('should show editing count subtitle', () => {
      render(<EditMessageModal {...bulkProps} />);
      expect(screen.getByText('Editing 3 messages')).toBeInTheDocument();
    });

    it('should start with empty text field', () => {
      render(<EditMessageModal {...bulkProps} />);
      const textarea = screen.getByLabelText('New content') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('should use "New content" label', () => {
      render(<EditMessageModal {...bulkProps} />);
      expect(screen.getByLabelText('New content')).toBeInTheDocument();
    });

    it('should show warning when content is empty and all messages have attachments', () => {
      render(<EditMessageModal {...bulkProps} />);
      expect(screen.getByText(/Saving with empty content will clear message text/)).toBeInTheDocument();
    });

    it('should disable Save when content is empty and some messages lack attachments', () => {
      const mixed = [
        createMockMessage({ id: 'a', attachments: [createMockAttachment()] }),
        createMockMessage({ id: 'b' }),
      ];
      render(<EditMessageModal {...bulkProps} messages={mixed} messageCount={2} />);
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(screen.getByText(/Some selected messages have no attachments or embeds/)).toBeInTheDocument();
    });

    it('should call onSave with content when Save is clicked', () => {
      const onSave = vi.fn();
      render(<EditMessageModal {...bulkProps} onSave={onSave} />);
      const textarea = screen.getByLabelText('New content');
      fireEvent.change(textarea, { target: { value: 'Bulk content' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSave).toHaveBeenCalledWith('Bulk content');
    });
  });
});
