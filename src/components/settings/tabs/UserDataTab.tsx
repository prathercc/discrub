import { Box, FormControl, InputLabel, MenuItem, Select, FormControlLabel, Checkbox, Typography } from '@mui/material';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting, UserDataRefreshRate } from 'discrub-core/discrub-enum';

interface UserDataTabProps {
  formValues: AppSettings;
  onChange: (key: DiscrubSetting, value: string) => void;
}

export const UserDataTab = ({ formValues, onChange }: UserDataTabProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Control how user data is fetched and cached from Discord.
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.REACTIONS_ENABLED] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.REACTIONS_ENABLED, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Enable reactions"
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.SERVER_NICKNAME_LOOKUP] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.SERVER_NICKNAME_LOOKUP, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Look up server nicknames"
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.DISPLAY_NAME_LOOKUP] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.DISPLAY_NAME_LOOKUP, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Look up display names"
      />

      <FormControl fullWidth>
        <InputLabel>User Data Refresh Rate</InputLabel>
        <Select
          value={formValues[DiscrubSetting.APP_USER_DATA_REFRESH_RATE]}
          label="User Data Refresh Rate"
          onChange={(e) => onChange(DiscrubSetting.APP_USER_DATA_REFRESH_RATE, e.target.value)}
        >
          <MenuItem value={UserDataRefreshRate.NEVER}>Never</MenuItem>
          <MenuItem value={UserDataRefreshRate.DAILY}>Daily</MenuItem>
          <MenuItem value={UserDataRefreshRate.WEEKLY}>Weekly</MenuItem>
          <MenuItem value={UserDataRefreshRate.MONTHLY}>Monthly</MenuItem>
        </Select>
        <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
          How often to re-fetch user profiles, nicknames, and roles from Discord
        </Typography>
      </FormControl>
    </Box>
  );
};
