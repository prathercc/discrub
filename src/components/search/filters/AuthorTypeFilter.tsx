import { Box, Typography, Select, MenuItem } from '@mui/material';
import { AuthorType } from 'discrub-core/discord-enum';
import { useTranslation } from 'react-i18next';

interface AuthorTypeFilterProps {
  value: AuthorType | null | undefined;
  onChange: (value: AuthorType | null) => void;
}

const UNSET_VALUE = '__any__';

/**
 * AuthorTypeFilter - filter messages by author type (user/bot/webhook)
 */
const AuthorTypeFilter = ({ value, onChange }: AuthorTypeFilterProps) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {t('filters.authorType')}
      </Typography>
      <Select
        value={value ?? UNSET_VALUE}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === UNSET_VALUE ? null : (val as AuthorType));
        }}
        size="small"
        fullWidth
      >
        <MenuItem value={UNSET_VALUE}>{t('filters.any')}</MenuItem>
        <MenuItem value={AuthorType.USER}>{t('filters.authorUser')}</MenuItem>
        <MenuItem value={AuthorType.BOT}>{t('filters.authorBot')}</MenuItem>
        <MenuItem value={AuthorType.WEBHOOK}>{t('filters.authorWebhook')}</MenuItem>
      </Select>
    </Box>
  );
};

export default AuthorTypeFilter;
