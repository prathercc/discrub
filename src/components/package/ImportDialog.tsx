import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Archive as ArchiveIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  importPackage,
  selectPackageError,
  selectPackageStatus,
} from '@features/package/packageSlice';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

const ImportDialog = ({ open, onClose, onImported }: ImportDialogProps) => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectPackageStatus);
  const error = useAppSelector(selectPackageError);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isParsing = status === 'parsing';

  const handleFile = useCallback(
    async (file: File) => {
      const result = await dispatch(importPackage(file));
      if (importPackage.fulfilled.match(result)) {
        onImported?.();
        onClose();
      }
    },
    [dispatch, onImported, onClose],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <Dialog open={open} onClose={isParsing ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ArchiveIcon color="primary" />
        Import Discord Data Package
        <Box sx={{ flex: 1 }} />
        <IconButton
          onClick={onClose}
          aria-label="Close import dialog"
          size="small"
          disabled={isParsing}
          sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload the ZIP file from Discord → Settings → Privacy &amp; Safety →
          Request All of My Data. Your package is processed entirely in your
          browser — nothing is uploaded.
        </Typography>

        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => !isParsing && inputRef.current?.click()}
          role="button"
          aria-label="Upload Discord data package"
          tabIndex={isParsing ? -1 : 0}
          sx={{
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: isParsing ? 'default' : 'pointer',
            backgroundColor: isDragging ? 'action.hover' : 'transparent',
            transition: 'all 150ms ease',
            '&:hover': {
              borderColor: isParsing ? 'divider' : 'primary.main',
              backgroundColor: isParsing ? 'transparent' : 'action.hover',
            },
          }}
        >
          {isParsing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Parsing package…
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Drop ZIP here or click to browse
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Only your Discord data package is supported
              </Typography>
            </Box>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={handleInputChange}
            data-testid="package-file-input"
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isParsing}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;
