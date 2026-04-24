import { Box, Typography, Select, MenuItem } from '@mui/material';
import { IsPinnedType } from 'discrub-core/discord-enum';

interface PinnedFilterProps {
  value: IsPinnedType;
  onChange: (value: IsPinnedType) => void;
}

/**
 * PinnedFilter - filter messages by pinned status using a dropdown
 */
const PinnedFilter = ({ value, onChange }: PinnedFilterProps) => {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        Pinned
      </Typography>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as IsPinnedType)}
        size="small"
        fullWidth
      >
        <MenuItem value={IsPinnedType.UNSET}>Any</MenuItem>
        <MenuItem value={IsPinnedType.YES}>True</MenuItem>
        <MenuItem value={IsPinnedType.NO}>False</MenuItem>
      </Select>
    </Box>
  );
};

export default PinnedFilter;
