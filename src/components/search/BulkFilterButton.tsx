import { Box, Button, Typography } from '@mui/material';
import { FilterList as FilterIcon } from '@mui/icons-material';

interface BulkFilterButtonProps {
  /**
   * Count of active filters from FilterModal.countActiveFilters().
   * 0 → zero-state outlined "Add filters" button. >0 → contained
   * primary "Edit filters (N)" button. Clearing happens inside the
   * FilterModal itself (it has its own "Clear (N)" action), so no
   * clear affordance is exposed here — kept single-action by design.
   */
  filterCount: number;
  onOpen: () => void;
  /** Helper copy shown under the button (zero-state only). Optional. */
  helperText?: string;
  /** aria-label override for the zero-state button. */
  addLabel?: string;
  /** aria-label override for the active-state button. */
  editLabel?: string;
}

/**
 * Shared filter-affordance for bulk dialogs. One Button that flips
 * variant and label based on whether any filters are active.
 *
 * Used by #112's BulkPurgeDialog (Messages / Attachments Only target
 * surface) and BulkExportDialog (optional narrowing).
 */
const BulkFilterButton = ({
  filterCount,
  onOpen,
  helperText,
  addLabel = 'Add filters',
  editLabel = 'Edit filters',
}: BulkFilterButtonProps) => {
  const isActive = filterCount > 0;
  return (
    <Box>
      <Button
        variant={isActive ? 'contained' : 'outlined'}
        color="primary"
        size="small"
        startIcon={<FilterIcon />}
        onClick={onOpen}
        aria-label={isActive ? editLabel : addLabel}
      >
        {isActive ? `${editLabel} (${filterCount})` : addLabel}
      </Button>
      {!isActive && helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default BulkFilterButton;
