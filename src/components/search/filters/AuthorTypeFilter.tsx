import { Box, Typography, Select, MenuItem } from '@mui/material';
import { AuthorType } from 'discrub-core/discord-enum';

interface AuthorTypeFilterProps {
  value: AuthorType | null | undefined;
  onChange: (value: AuthorType | null) => void;
}

const UNSET_VALUE = '__any__';

/**
 * AuthorTypeFilter - filter messages by author type (user/bot/webhook)
 */
const AuthorTypeFilter = ({ value, onChange }: AuthorTypeFilterProps) => {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        Author Type
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
        <MenuItem value={UNSET_VALUE}>Any</MenuItem>
        <MenuItem value={AuthorType.USER}>user</MenuItem>
        <MenuItem value={AuthorType.BOT}>bot</MenuItem>
        <MenuItem value={AuthorType.WEBHOOK}>webhook</MenuItem>
      </Select>
    </Box>
  );
};

export default AuthorTypeFilter;
