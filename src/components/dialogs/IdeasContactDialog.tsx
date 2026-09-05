import { Box, Dialog, DialogContent, Typography } from '@mui/material';
import {
  EmojiObjects as IdeasIcon,
  Email as EmailIcon,
  Language as SiteIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import KofiIcon from '@components/supporter/KofiIcon';
import { KOFI_COMMISSIONS_URL, SITE_URL, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@services/kofiLinks';
import { BOT_IDEA_MAILTO } from '@components/welcome/bots';
import { useTranslation } from 'react-i18next';

interface IdeasContactDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ContactRow {
  id: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  external?: boolean;
}

const ROWS: ContactRow[] = [
  {
    id: 'email',
    href: SUPPORT_MAILTO,
    icon: <EmailIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
    label: SUPPORT_EMAIL,
    hint: 'ideas.hintEmail',
  },
  {
    id: 'commissions',
    href: KOFI_COMMISSIONS_URL,
    icon: <KofiIcon size={18} />,
    label: 'ideas.commissions',
    hint: 'ideas.hintCommissions',
    external: true,
  },
  {
    id: 'bot',
    href: BOT_IDEA_MAILTO,
    icon: <BotIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
    label: 'ideas.bot',
    hint: 'workbench@pratherbytecraft.com',
  },
  {
    id: 'site',
    href: SITE_URL,
    icon: <SiteIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
    label: 'pratherbytecraft.com',
    hint: 'ideas.hintSite',
    external: true,
  },
];

/**
 * "Ideas & Contact" from the More menu. One row per way to reach out:
 * email, Ko-fi commissions, bot requests, and the company site. Lives here
 * (not inline in TopBar) so the rows can grow without bloating the top bar.
 */
const IdeasContactDialog = ({ open, onClose }: IdeasContactDialogProps) => {
  const { t } = useTranslation();
  return (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
    <DialogContent sx={{ textAlign: 'center', py: 4, px: 3, position: 'relative' }}>
      <DialogCloseIcon onClose={onClose} label={t('ideas.close')} />
      <IdeasIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t('ideas.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('ideas.intro')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {ROWS.map((row) => (
          <Box
            key={row.id}
            component="a"
            href={row.href}
            data-testid={`contact-${row.id}`}
            {...(row.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderRadius: 1,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              textDecoration: 'none',
              textAlign: 'left',
              transition: 'background-color 150ms ease',
              '&:hover': { bgcolor: 'action.selected', color: 'text.primary' },
            }}
          >
            {row.icon}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">{t(row.label, { defaultValue: row.label })}</Typography>
              {row.hint && (
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                  {t(row.hint, { defaultValue: row.hint })}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </DialogContent>
  </Dialog>
  );
};

export default IdeasContactDialog;
