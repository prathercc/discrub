import { Box, Typography, ToggleButtonGroup, ToggleButton, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { startOfDay, endOfDay } from 'date-fns';

export type DateFilterMode = 'before' | 'after' | 'during' | null;

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  dateMode?: DateFilterMode;
  onDateModeChange?: (mode: DateFilterMode) => void;
}

/**
 * DateRangeFilter - date range selection with progressive disclosure
 */
const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  dateMode = null,
  onDateModeChange,
}: DateRangeFilterProps) => {
  const handleModeChange = (_e: React.MouseEvent<HTMLElement>, newMode: DateFilterMode) => {
    if (newMode !== null) {
      onDateModeChange?.(newMode);
      // Clear dates when switching modes
      if (newMode !== dateMode) {
        onStartDateChange(null);
        onEndDateChange(null);
      }
    }
  };

  const handleAddDate = () => {
    onDateModeChange?.('before');
  };

  const handleDuringDateChange = (date: Date | null) => {
    if (date) {
      onStartDateChange(startOfDay(date));
      onEndDateChange(endOfDay(date));
    } else {
      onStartDateChange(null);
      onEndDateChange(null);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Date
        </Typography>
        {dateMode === null ? (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddDate}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Add date
          </Button>
        ) : (
          <>
            <ToggleButtonGroup
              value={dateMode}
              exclusive
              onChange={handleModeChange}
              size="small"
              sx={{ mb: 1.5, '& .MuiToggleButton-root': { px: 2, py: 0.5, fontSize: '0.75rem' } }}
            >
              <ToggleButton value="before">Before</ToggleButton>
              <ToggleButton value="after">After</ToggleButton>
              <ToggleButton value="during">During</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {dateMode === 'during' ? (
                <DatePicker
                  label="During"
                  value={startDate}
                  onChange={handleDuringDateChange}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 200 },
                    },
                  }}
                />
              ) : dateMode === 'after' ? (
                <DateTimePicker
                  label="After"
                  value={startDate}
                  onChange={onStartDateChange}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 240 },
                    },
                  }}
                />
              ) : (
                <DateTimePicker
                  label="Before"
                  value={endDate}
                  onChange={onEndDateChange}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 240 },
                    },
                  }}
                />
              )}
            </Box>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangeFilter;
