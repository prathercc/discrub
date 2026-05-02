import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  MenuBook as GuideIcon,
} from '@mui/icons-material';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import onboardingMarkdown from '../../../ONBOARDING.md?raw';

interface OnboardingGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const markdownStyles = {
  '& h1': {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'text.primary',
    mb: 1.5,
    mt: 3,
    '&:first-of-type': { mt: 0 },
  },
  '& h2': {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'text.primary',
    mb: 1,
    mt: 3,
    pb: 0.75,
    borderBottom: 1,
    borderColor: 'divider',
  },
  '& h3': {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'text.primary',
    mb: 0.5,
    mt: 2,
  },
  '& p': { color: 'text.secondary', lineHeight: 1.7, mb: 1.5 },
  '& ul, & ol': { color: 'text.secondary', pl: 3, mb: 1.5 },
  '& li': { mb: 0.5, lineHeight: 1.6 },
  '& a': {
    color: 'primary.main',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
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
    mb: 1.5,
    '& code': { backgroundColor: 'transparent', p: 0 },
  },
  '& blockquote': {
    borderLeft: 3,
    borderColor: 'primary.main',
    pl: 2,
    ml: 0,
    my: 1.5,
    color: 'text.secondary',
    fontStyle: 'italic',
  },
  '& hr': { border: 'none', borderTop: 1, borderColor: 'divider', my: 3 },
  '& strong': { color: 'text.primary', fontWeight: 600 },
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    mb: 2,
    fontSize: '0.875rem',
  },
  '& th': {
    textAlign: 'left',
    color: 'text.primary',
    fontWeight: 600,
    p: 1,
    borderBottom: 2,
    borderColor: 'divider',
    bgcolor: 'action.hover',
  },
  '& td': {
    color: 'text.secondary',
    p: 1,
    borderBottom: 1,
    borderColor: 'divider',
  },
  '& tr:last-child td': { borderBottom: 'none' },
};

const OnboardingGuideModal = ({ open, onClose }: OnboardingGuideModalProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          maxHeight: '85vh',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          pr: 5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <GuideIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          Upgrading from Discrub Classic
        </Typography>
        <Chip
          label="Migration Guide"
          size="small"
          variant="outlined"
          sx={{ color: 'text.secondary', borderColor: 'divider' }}
        />
        <DialogCloseIcon onClose={onClose} label="Close guide" />
      </Box>
      <DialogContent sx={{ px: 3, py: 2 }}>
        <Box sx={markdownStyles}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Resolve screenshot paths to bundled assets in public/onboarding/
              img: ({ src, alt, ...props }) => {
                if (!src) return null;
                const resolvedSrc = src.startsWith('docs/screenshots/')
                  ? src.replace('docs/screenshots/', '/onboarding/')
                  : src;
                return (
                  <img
                    src={resolvedSrc}
                    alt={alt || ''}
                    loading="lazy"
                    style={{ maxWidth: '100%', borderRadius: 4, marginTop: 8, marginBottom: 8 }}
                    {...props}
                  />
                );
              },
              // Open links in new tab
              a: ({ children, href, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {onboardingMarkdown}
          </ReactMarkdown>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OnboardingGuideModal;
