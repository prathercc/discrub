import { Box, Typography, ToggleButton, ToggleButtonGroup, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { startOfDay, endOfDay } from 'date-fns';
import { isInvalidDate } from '@/utils/dateValidation';
import { getDateLocale } from '@/i18n/dateLocale';
import { useTranslation } from 'react-i18next';

export type DateFilterMode = 'before' | 'after' | 'during' | 'between' | null;

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  dateMode?: DateFilterMode;
  onDateModeChange?: (mode: DateFilterMode) => void;
}

/**
 * DateRangeFilter — Before and After can be selected together to express a
 * between-dates range; During remains a single-day shortcut and is mutually
 * exclusive with the others.
 */
const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  dateMode = null,
  onDateModeChange,
}: DateRangeFilterProps) => {
  const beforeActive = dateMode === 'before' || dateMode === 'between';
  const afterActive = dateMode === 'after' || dateMode === 'between';
  const duringActive = dateMode === 'during';

  // #250: while a typed value is incomplete the picker reports an Invalid
  // Date. Mark the field so the disabled Apply button has a visible reason.
  const startInvalid = isInvalidDate(startDate);
  const endInvalid = isInvalidDate(endDate);
  const { t } = useTranslation();
  const INCOMPLETE = t('filters.incompleteDateTime');

  const groupValue: string[] = duringActive
    ? ['during']
    : ([beforeActive && 'before', afterActive && 'after'].filter(Boolean) as string[]);

  const handleGroupChange = (_e: React.MouseEvent<HTMLElement>, newValue: string[]) => {
    const newDuring = newValue.includes('during');
    const newBefore = newValue.includes('before');
    const newAfter = newValue.includes('after');

    // During is mutually exclusive with Before/After. Whenever entering
    // or leaving During we clear both bounds (the lib semantics of the
    // two modes don't overlap cleanly).
    if (newDuring && !duringActive) {
      onStartDateChange(null);
      onEndDateChange(null);
      onDateModeChange?.('during');
      return;
    }
    if (duringActive && (newBefore || newAfter)) {
      onStartDateChange(null);
      onEndDateChange(null);
      if (newBefore && newAfter) onDateModeChange?.('between');
      else if (newBefore) onDateModeChange?.('before');
      else onDateModeChange?.('after');
      return;
    }
    if (duringActive && !newDuring) {
      onStartDateChange(null);
      onEndDateChange(null);
      onDateModeChange?.(null);
      return;
    }

    // Normal Before/After toggling — clear the bound the user just turned off.
    if (beforeActive && !newBefore) onEndDateChange(null);
    if (afterActive && !newAfter) onStartDateChange(null);
    if (newBefore && newAfter) onDateModeChange?.('between');
    else if (newBefore) onDateModeChange?.('before');
    else if (newAfter) onDateModeChange?.('after');
    else onDateModeChange?.(null);
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
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={getDateLocale()}>
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          {t('filters.date')}
        </Typography>
        {dateMode === null ? (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddDate}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            {t('filters.addDate')}
          </Button>
        ) : (
          <>
            <ToggleButtonGroup
              value={groupValue}
              onChange={handleGroupChange}
              size="small"
              sx={{ mb: 1.5, '& .MuiToggleButton-root': { px: 2, py: 0.5, fontSize: '0.75rem' } }}
            >
              <ToggleButton value="before">{t('filters.before')}</ToggleButton>
              <ToggleButton value="after">{t('filters.after')}</ToggleButton>
              <ToggleButton value="during">{t('filters.during')}</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {duringActive ? (
                <DatePicker
                  label={t('filters.during')}
                  value={startDate}
                  onChange={handleDuringDateChange}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 200 },
                      error: startInvalid,
                      helperText: startInvalid ? t('filters.incompleteDate') : undefined,
                    },
                  }}
                />
              ) : (
                <>
                  {afterActive && (
                    <DateTimePicker
                      label={t('filters.after')}
                      value={startDate}
                      onChange={onStartDateChange}
                      slotProps={{
                        textField: {
                          size: 'small',
                          sx: { minWidth: 240 },
                          error: startInvalid,
                          helperText: startInvalid ? INCOMPLETE : undefined,
                        },
                      }}
                    />
                  )}
                  {beforeActive && (
                    <DateTimePicker
                      label={t('filters.before')}
                      value={endDate}
                      onChange={onEndDateChange}
                      slotProps={{
                        textField: {
                          size: 'small',
                          sx: { minWidth: 240 },
                          error: endInvalid,
                          helperText: endInvalid ? INCOMPLETE : undefined,
                        },
                      }}
                    />
                  )}
                </>
              )}
            </Box>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangeFilter;
