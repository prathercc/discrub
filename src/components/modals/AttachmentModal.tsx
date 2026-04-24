import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Link,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Avatar,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  PictureAsPdf as PdfIcon,
  FolderZip as ArchiveIcon,
  Code as CodeIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteAllIcon,
} from '@mui/icons-material';
import type { Message, Attachment } from 'discrub-core/types/discord-types';

interface AttachmentModalProps {
  open: boolean;
  onClose: () => void;
  message: Message | null;
  onDeleteAttachment?: (message: Message, attachment: Attachment) => Promise<void>;
  onDeleteAllAttachments?: (message: Message) => Promise<void>;
}

/** Get the appropriate MUI icon for a file type */
function getFileTypeIcon(contentType?: string, filename?: string) {
  const ct = (contentType || '').toLowerCase();
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';

  if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <ImageIcon sx={{ color: '#4caf50' }} />;
  }
  if (ct.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return <VideoIcon sx={{ color: '#ff9800' }} />;
  }
  if (ct.startsWith('audio/') || ['mp3', 'ogg', 'wav', 'flac', 'm4a'].includes(ext)) {
    return <AudioIcon sx={{ color: '#9c27b0' }} />;
  }
  if (ct === 'application/pdf' || ext === 'pdf') {
    return <PdfIcon sx={{ color: '#f44336' }} />;
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext) || ct.includes('zip') || ct.includes('archive')) {
    return <ArchiveIcon sx={{ color: '#ff9800' }} />;
  }
  if (['json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'txt', 'md'].includes(ext) || ct.startsWith('text/')) {
    return <CodeIcon sx={{ color: '#5865f2' }} />;
  }
  return <FileIcon sx={{ color: 'text.secondary' }} />;
}

/** Extract short file type label from content_type or filename */
function getFileTypeLabel(contentType?: string, filename?: string): string {
  const ext = (filename || '').split('.').pop()?.toUpperCase();
  if (ext && ext.length <= 5 && ext !== filename?.toUpperCase()) return ext;
  if (contentType) {
    const sub = contentType.split('/').pop()?.toUpperCase() || '';
    return sub.length <= 5 ? sub : sub.slice(0, 4);
  }
  return 'FILE';
}

/** Format file size to human-readable string */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Check if content type is an image */
function isImage(contentType?: string, filename?: string): boolean {
  const ct = (contentType || '').toLowerCase();
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  return ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext);
}

/** Format duration in seconds to mm:ss */
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * AttachmentModal - displays and manages message attachments
 */
const AttachmentModal = ({
  open,
  onClose,
  message,
  onDeleteAttachment,
}: AttachmentModalProps) => {
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());

  // Auto-close when attachments become empty
  useEffect(() => {
    if (open && (!message || !message.attachments || message.attachments.length === 0)) {
      onClose();
    }
  }, [open, message, onClose]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setDeletingAttachmentId(null);
      setFailedThumbnails(new Set());
    }
  }, [open]);

  if (!message || !message.attachments || message.attachments.length === 0) {
    return null;
  }

  const isInteractive = !!onDeleteAttachment;
  const isLastAttachment = message.attachments.length === 1;
  const wouldDeleteMessage = isLastAttachment && !message.content?.trim();

  const handleDelete = async (attachment: Attachment) => {
    if (!onDeleteAttachment || !message) return;
    setDeletingAttachmentId(attachment.id);
    await onDeleteAttachment(message, attachment);
    setDeletingAttachmentId(null);
  };

  const handleDeleteAll = async () => {
    if (!onDeleteAttachment || !message) return;
    const attachmentIds = message.attachments.map((a) => a.id);
    for (const attId of attachmentIds) {
      const att = message.attachments.find((a) => a.id === attId);
      if (!att) continue;
      setDeletingAttachmentId(attId);
      await onDeleteAttachment(message, att);
    }
    setDeletingAttachmentId(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          animation: 'fade-in-scale 300ms ease',
        },
      }}
    >
      <DialogTitle>
        Attachments ({message.attachments.length})
      </DialogTitle>
      <DialogContent>
        {wouldDeleteMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Removing the last attachment will delete the entire message since it has no text content.
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {message.attachments.map((attachment, index) => {
            const showThumbnail = isImage(attachment.content_type, attachment.filename) && !failedThumbnails.has(attachment.id);
            const thumbnailUrl = showThumbnail
              ? `${attachment.proxy_url}?width=80&height=80`
              : undefined;

            return (
              <Box key={attachment.id}>
                {index > 0 && <Divider sx={{ opacity: 0.3 }} />}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 0.5 }}>
                  {/* Thumbnail or file type icon */}
                  {thumbnailUrl ? (
                    <Avatar
                      variant="rounded"
                      src={thumbnailUrl}
                      sx={{ width: 40, height: 40, flexShrink: 0 }}
                      imgProps={{ loading: 'lazy' }}
                      onError={() => setFailedThumbnails((prev) => new Set(prev).add(attachment.id))}
                    >
                      {getFileTypeIcon(attachment.content_type, attachment.filename)}
                    </Avatar>
                  ) : (
                    <Avatar
                      variant="rounded"
                      sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: 'action.hover' }}
                    >
                      {getFileTypeIcon(attachment.content_type, attachment.filename)}
                    </Avatar>
                  )}

                  {/* File info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.875rem',
                      }}
                    >
                      {attachment.filename}
                    </Link>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                      <Chip
                        label={getFileTypeLabel(attachment.content_type, attachment.filename)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(attachment.size)}
                      </Typography>
                      {attachment.width && attachment.height && (
                        <Typography variant="caption" color="text.secondary">
                          {attachment.width}×{attachment.height}
                        </Typography>
                      )}
                      {attachment.duration_secs && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(attachment.duration_secs)}
                        </Typography>
                      )}
                    </Box>
                    {attachment.description && (
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                        {attachment.description}
                      </Typography>
                    )}
                  </Box>

                  {/* Delete button */}
                  {isInteractive && (
                    deletingAttachmentId === attachment.id ? (
                      <CircularProgress size={18} />
                    ) : (
                      <IconButton
                        aria-label="delete attachment"
                        size="small"
                        color="error"
                        disabled={deletingAttachmentId !== null}
                        onClick={() => handleDelete(attachment)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        {isInteractive && message.attachments.length > 1 && (
          <Button
            size="small"
            color="error"
            disabled={deletingAttachmentId !== null}
            startIcon={<DeleteAllIcon />}
            onClick={handleDeleteAll}
          >
            Remove All
          </Button>
        )}
        <Button variant="outlined" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AttachmentModal;
