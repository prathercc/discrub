import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { Palette as PaletteIcon } from '@mui/icons-material';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting, DateFormat, TimeFormat } from 'discrub-core/discrub-enum';
import { useAppDispatch } from '@/app/hooks';
import { setSupporterDialogOpen } from '@features/supporter/supporterSlice';

interface DisplayTabProps {
  formValues: AppSettings;
  onChange: (key: DiscrubSetting, value: string) => void;
}

export const DisplayTab = ({ formValues, onChange }: DisplayTabProps) => {
  const dispatch = useAppDispatch();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Customize how dates, times, and other information are displayed.
      </Typography>

      {/* Themes live in the Themes hub only; this pointer catches
          anyone who comes looking for them here. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Looking for themes?
        </Typography>
        <Button
          size="small"
          startIcon={<PaletteIcon />}
          onClick={() => dispatch(setSupporterDialogOpen(true))}
          data-testid="display-open-themes-hub"
        >
          Open the Themes hub
        </Button>
      </Box>

      <FormControl fullWidth>
        <InputLabel>Date Format</InputLabel>
        <Select
          value={formValues[DiscrubSetting.DATE_FORMAT]}
          label="Date Format"
          onChange={(e) => onChange(DiscrubSetting.DATE_FORMAT, e.target.value)}
        >
          <MenuItem value={DateFormat.MMDDYYYY}>MM/DD/YYYY</MenuItem>
          <MenuItem value={DateFormat.DDMMYYYY}>DD/MM/YYYY</MenuItem>
        </Select>
        <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
          How dates are formatted throughout the application
        </Typography>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>Time Format</InputLabel>
        <Select
          value={formValues[DiscrubSetting.TIME_FORMAT]}
          label="Time Format"
          onChange={(e) => onChange(DiscrubSetting.TIME_FORMAT, e.target.value)}
        >
          <MenuItem value={TimeFormat._12HOUR}>12 Hour (AM/PM)</MenuItem>
          <MenuItem value={TimeFormat._24HOUR}>24 Hour</MenuItem>
          <MenuItem value={TimeFormat._12HOUR_WITH_SECONDS}>12 Hour with Seconds</MenuItem>
          <MenuItem value={TimeFormat._24HOUR_WITH_SECONDS}>24 Hour with Seconds</MenuItem>
        </Select>
        <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
          How times are formatted throughout the application
        </Typography>
      </FormControl>
    </Box>
  );
};
