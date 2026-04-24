import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material';
import {
  Campaign as AnnouncementIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AnnouncementModalProps {
  open: boolean;
  onDismiss: () => void;
  markdown: string | null;
  isLoading?: boolean;
  error?: string | null;
}

const AnnouncementModal = ({ open, onDismiss, markdown, isLoading, error }: AnnouncementModalProps) => {
  return (
    <Dialog open={open} onClose={onDismiss} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AnnouncementIcon color="primary" />
        Announcement
        <Box sx={{ flex: 1 }} />
        <IconButton
          onClick={onDismiss}
          aria-label="Close announcement"
          size="small"
          sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {isLoading && (
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="40%" height={24} />
            <Skeleton variant="text" width="100%" height={16} />
            <Skeleton variant="text" width="95%" height={16} />
            <Skeleton variant="text" width="80%" height={16} />
            <Skeleton variant="text" width="90%" height={16} />
          </Box>
        )}
        {error && !isLoading && (
          <Typography color="error" variant="body2" sx={{ py: 2 }}>
            {error}
          </Typography>
        )}
        {markdown && !isLoading && !error && (
          <Box
            sx={{
              pt: 1,
              '& h1': { fontSize: '1.5rem', fontWeight: 700, color: 'text.primary', mb: 1, mt: 2 },
              '& h2': { fontSize: '1.25rem', fontWeight: 600, color: 'text.primary', mb: 1, mt: 2 },
              '& h3': { fontSize: '1.1rem', fontWeight: 600, color: 'text.primary', mb: 0.5, mt: 1.5 },
              '& p': { color: 'text.secondary', lineHeight: 1.7, mb: 1 },
              '& ul, & ol': { color: 'text.secondary', pl: 3, mb: 1 },
              '& li': { mb: 0.5 },
              '& a': { color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
              '& code': {
                backgroundColor: 'action.hover',
                color: 'text.primary',
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: '0.85em',
                fontFamily: 'Consolas, Monaco, monospace',
              },
              '& pre': {
                backgroundColor: 'action.hover',
                borderRadius: 1,
                p: 1.5,
                overflow: 'auto',
                mb: 1,
                '& code': { backgroundColor: 'transparent', p: 0 },
              },
              '& blockquote': {
                borderLeft: 3,
                borderColor: 'primary.main',
                pl: 2,
                ml: 0,
                color: 'text.secondary',
                fontStyle: 'italic',
              },
              '& hr': { border: 'none', borderTop: 1, borderColor: 'divider', my: 2 },
              '& img': { maxWidth: '100%', borderRadius: 1 },
              '& strong': { color: 'text.primary', fontWeight: 600 },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss} variant="outlined">
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AnnouncementModal;
