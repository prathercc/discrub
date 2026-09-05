import { Box, Typography, Select, MenuItem } from '@mui/material';
import { IsPinnedType } from 'discrub-core/discord-enum';
import { useTranslation } from 'react-i18next';

interface PinnedFilterProps {
  value: IsPinnedType;
  onChange: (value: IsPinnedType) => void;
}

/**
 * PinnedFilter - filter messages by pinned status using a dropdown
 */
const PinnedFilter = ({ value, onChange }: PinnedFilterProps) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {t('filters.pinned')}
      </Typography>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as IsPinnedType)}
        size="small"
        fullWidth
      >
        <MenuItem value={IsPinnedType.UNSET}>{t('filters.any')}</MenuItem>
        <MenuItem value={IsPinnedType.YES}>{t('filters.true')}</MenuItem>
        <MenuItem value={IsPinnedType.NO}>{t('filters.false')}</MenuItem>
      </Select>
    </Box>
  );
};

export default PinnedFilter;
