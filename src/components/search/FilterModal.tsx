import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as RefineIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { SearchCriteria, ExportUserMap } from 'discrub-core/types/discrub-types';
import { IsPinnedType } from 'discrub-core/discord-enum';
import DateRangeFilter, { type DateFilterMode } from './filters/DateRangeFilter';
import MessageTypeFilter from './filters/MessageTypeFilter';
import UserPicker from '@components/ui/UserPicker';
import TourSpot from '@components/welcome/TourSpot';
import PinnedFilter from './filters/PinnedFilter';
import AuthorTypeFilter from './filters/AuthorTypeFilter';
import { defaultCriteria } from './searchConstants';
import type { AuthorType } from 'discrub-core/discord-enum';

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  onServerSearch: (criteria: SearchCriteria) => void;
  onRefine: (criteria: SearchCriteria) => void;
  onClearSearch: () => void;
  onClearRefine: () => void;
  savedSearchCriteria?: SearchCriteria;
  savedRefineCriteria?: SearchCriteria;
  cachedUserMap: ExportUserMap;
  currentUserId: string;
  // For bulk-operation callers (bulk purge / bulk export) the Refine
  // layer is meaningless — messages aren't loaded into a local table,
  // so "filter already-loaded" has nothing to filter. Hide it.
  hideRefineSection?: boolean;
  // Label on the Search section's confirm button. Defaults to "Search"
  // (live in-table search); bulk callers override to "Apply filters"
  // to match their "narrow this bulk op" semantics.
  applyButtonLabel?: string;
}

/**
 * Counts the number of active filters in criteria
 */
export const countActiveFilters = (criteria: SearchCriteria): number => {
  let count = 0;
  if (criteria.searchMessageContent) count++;
  if (criteria.userIds.length > 0) count += criteria.userIds.length;
  if (criteria.selectedHasTypes.length > 0) count += criteria.selectedHasTypes.length;
  if (criteria.searchAfterDate) count++;
  if (criteria.searchBeforeDate) count++;
  if (criteria.isPinned !== IsPinnedType.UNSET) count++;
  if (criteria.authorType) count++;
  if (criteria.mentionIds && criteria.mentionIds.length > 0) count += criteria.mentionIds.length;
  return count;
};

export const countTotalFilters = (search: SearchCriteria, refine: SearchCriteria): number => {
  return countActiveFilters(search) + countActiveFilters(refine);
};

const inferDateMode = (c?: SearchCriteria): DateFilterMode => {
  if (!c) return null;
  if (c.searchAfterDate && !c.searchBeforeDate) return 'after';
  if (c.searchBeforeDate && !c.searchAfterDate) return 'before';
  if (c.searchAfterDate && c.searchBeforeDate) return 'during';
  return null;
};

/**
 * FilterModal - Two-section filter dialog with independent Search (server) and Refine (local) layers.
 * Each section is collapsible, has its own action buttons, and maintains independent state.
 */
const FilterModal = ({
  open, onClose,
  onServerSearch, onRefine, onClearSearch, onClearRefine,
  savedSearchCriteria, savedRefineCriteria,
  cachedUserMap, currentUserId,
  hideRefineSection = false,
  applyButtonLabel,
}: FilterModalProps) => {
  // Search section state
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>(savedSearchCriteria ?? defaultCriteria);
  const [dateMode, setDateMode] = useState<DateFilterMode>(inferDateMode(savedSearchCriteria));
  const [searchExpanded, setSearchExpanded] = useState(true);

  // Refine section state
  const [refineCriteria, setRefineCriteria] = useState<SearchCriteria>(savedRefineCriteria ?? defaultCriteria);
  const [refineExpanded, setRefineExpanded] = useState(true);

  const updateSearchCriteria = (updater: SearchCriteria | ((prev: SearchCriteria) => SearchCriteria)) => {
    setSearchCriteria((prev) => typeof updater === 'function' ? updater(prev) : updater);
  };

  const updateRefineCriteria = (updater: SearchCriteria | ((prev: SearchCriteria) => SearchCriteria)) => {
    setRefineCriteria((prev) => typeof updater === 'function' ? updater(prev) : updater);
  };

  const searchFilterCount = useMemo(() => countActiveFilters(searchCriteria), [searchCriteria]);
  const refineFilterCount = useMemo(() => countActiveFilters(refineCriteria), [refineCriteria]);

  const searchHasChanges = JSON.stringify(searchCriteria) !== JSON.stringify(savedSearchCriteria ?? defaultCriteria);
  const refineHasChanges = JSON.stringify(refineCriteria) !== JSON.stringify(savedRefineCriteria ?? defaultCriteria);

  // --- Search section handlers ---
  const handleSearchApply = () => {
    if (searchFilterCount === 0) {
      onClearSearch();
    } else {
      onServerSearch(searchCriteria);
    }
    onClose();
  };

  const handleSearchClear = () => {
    updateSearchCriteria(defaultCriteria);
    setDateMode(null);
    onClearSearch();
  };

  // --- Refine section handlers ---
  const handleRefineApply = () => {
    if (refineFilterCount === 0) {
      onClearRefine();
    } else {
      onRefine(refineCriteria);
    }
    onClose();
  };

  const handleRefineClear = () => {
    updateRefineCriteria(defaultCriteria);
    onClearRefine();
  };

  // --- Shared styles ---
  const sectionContainerSx = (isSearch: boolean) => (theme: any) => ({
    borderRadius: 2,
    border: `1px solid ${isSearch ? (theme.palette.mode === 'dark' ? 'rgba(114, 137, 218, 0.25)' : theme.palette.primary.light) : theme.palette.divider}`,
    backgroundColor: isSearch ? 'transparent' : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
  });

  const sectionHeaderSx = (isSearch: boolean) => (theme: any) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    px: 2,
    py: 1,
    cursor: 'pointer',
    backgroundColor: isSearch
      ? (theme.palette.mode === 'dark' ? 'rgba(114, 137, 218, 0.08)' : 'rgba(88, 101, 242, 0.04)')
      : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
    '&:hover': {
      backgroundColor: isSearch
        ? (theme.palette.mode === 'dark' ? 'rgba(114, 137, 218, 0.12)' : 'rgba(88, 101, 242, 0.06)')
        : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
    },
    transition: 'background-color 150ms ease',
  });

  const sectionBodySx = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    px: 2,
    py: 2,
  };

  const actionBarSx = (isSearch: boolean) => (theme: any) => ({
    display: 'flex',
    gap: 1,
    justifyContent: 'flex-end',
    px: 2,
    py: 1.5,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: isSearch
      ? (theme.palette.mode === 'dark' ? 'rgba(114, 137, 218, 0.05)' : 'rgba(88, 101, 242, 0.02)')
      : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          Filters
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2, px: 2, overflowY: 'auto' }}>
        {/* ═══ SEARCH SECTION ═══ */}
        <Box sx={sectionContainerSx(true)}>
          {/* Collapsible header */}
          <Box sx={sectionHeaderSx(true)} onClick={() => setSearchExpanded(!searchExpanded)}>
            <SearchIcon sx={(theme) => ({ fontSize: 18, color: theme.palette.primary.main })} />
            <Typography variant="subtitle2" sx={(theme) => ({ fontWeight: 700, color: theme.palette.primary.main, flex: 1 })}>
              Search
            </Typography>
            {searchFilterCount > 0 && (
              <Chip label={searchFilterCount} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem', minWidth: 20 }} />
            )}
            <Chip label="Discord API" size="small" variant="outlined" color="primary" sx={{ height: 18, fontSize: '0.55rem' }} />
            <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary', transform: searchExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }} />
          </Box>

          <Collapse in={searchExpanded}>
            <Box sx={sectionBodySx}>
              {/* Content first — most common filter */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>Message Content</Typography>
                <TextField
                  fullWidth size="small" placeholder="Search message content..."
                  value={searchCriteria.searchMessageContent || ''}
                  onChange={(e) => updateSearchCriteria((p) => ({ ...p, searchMessageContent: e.target.value || null }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchApply(); }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>From</Typography>
                <UserPicker selectedUserIds={searchCriteria.userIds} onChange={(ids) => updateSearchCriteria((p) => ({ ...p, userIds: ids }))} cachedUserMap={cachedUserMap} currentUserId={currentUserId} label="" />
              </Box>

              <MessageTypeFilter selectedTypes={searchCriteria.selectedHasTypes} onChange={(types) => updateSearchCriteria((p) => ({ ...p, selectedHasTypes: types }))} />

              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>Mentions</Typography>
                <UserPicker selectedUserIds={searchCriteria.mentionIds || []} onChange={(ids) => updateSearchCriteria((p) => ({ ...p, mentionIds: ids }))} cachedUserMap={cachedUserMap} currentUserId={currentUserId} label="" />
              </Box>

              <DateRangeFilter
                startDate={searchCriteria.searchAfterDate || null}
                endDate={searchCriteria.searchBeforeDate || null}
                onStartDateChange={(d) => updateSearchCriteria((p) => ({ ...p, searchAfterDate: d }))}
                onEndDateChange={(d) => updateSearchCriteria((p) => ({ ...p, searchBeforeDate: d }))}
                dateMode={dateMode}
                onDateModeChange={setDateMode}
              />

              <AuthorTypeFilter value={searchCriteria.authorType} onChange={(v: AuthorType | null) => updateSearchCriteria((p) => ({ ...p, authorType: v }))} />

              <PinnedFilter value={searchCriteria.isPinned} onChange={(v) => updateSearchCriteria((p) => ({ ...p, isPinned: v }))} />
            </Box>

            {/* Sticky action bar */}
            <Box sx={actionBarSx(true)}>
              <Button size="small" onClick={handleSearchClear} disabled={searchFilterCount === 0} sx={{ textTransform: 'none' }} data-testid="clear-search-filters">
                Clear{searchFilterCount > 0 ? ` (${searchFilterCount})` : ''}
              </Button>
              <Button variant="contained" size="small" startIcon={<SearchIcon />} onClick={handleSearchApply} disabled={searchFilterCount === 0 && !searchHasChanges}>
                {applyButtonLabel ?? 'Search'}
              </Button>
            </Box>
          </Collapse>
        </Box>

        {/* ═══ REFINE SECTION ═══ */}
        {!hideRefineSection && (
        <Box sx={sectionContainerSx(false)}>
          {/* Collapsible header */}
          <Box sx={sectionHeaderSx(false)} onClick={() => setRefineExpanded(!refineExpanded)}>
            <RefineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', flex: 1 }}>
              Refine
            </Typography>
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'inline-flex' }}>
              <TourSpot stepKey="refine-section" size="compact" placement="bottom" />
            </Box>
            {refineFilterCount > 0 && (
              <Chip label={refineFilterCount} size="small" sx={{ height: 20, fontSize: '0.7rem', minWidth: 20, backgroundColor: 'action.selected' }} />
            )}
            <Chip label="Loaded messages" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.55rem', color: 'text.secondary', borderColor: 'divider' }} />
            <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary', transform: refineExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }} />
          </Box>

          <Collapse in={refineExpanded}>
            <Box sx={sectionBodySx}>
              {/* Content first */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>Content</Typography>
                <TextField
                  fullWidth size="small" placeholder="Filter by content..."
                  value={refineCriteria.searchMessageContent || ''}
                  onChange={(e) => updateRefineCriteria((p) => ({ ...p, searchMessageContent: e.target.value || null }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRefineApply(); }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>From</Typography>
                <UserPicker selectedUserIds={refineCriteria.userIds} onChange={(ids) => updateRefineCriteria((p) => ({ ...p, userIds: ids }))} cachedUserMap={cachedUserMap} currentUserId={currentUserId} label="" />
              </Box>

              <MessageTypeFilter selectedTypes={refineCriteria.selectedHasTypes} onChange={(types) => updateRefineCriteria((p) => ({ ...p, selectedHasTypes: types }))} />

              <PinnedFilter value={refineCriteria.isPinned} onChange={(v) => updateRefineCriteria((p) => ({ ...p, isPinned: v }))} />
            </Box>

            {/* Sticky action bar */}
            <Box sx={actionBarSx(false)}>
              <Button size="small" onClick={handleRefineClear} disabled={refineFilterCount === 0} sx={{ textTransform: 'none' }} data-testid="clear-refine-filters">
                Clear{refineFilterCount > 0 ? ` (${refineFilterCount})` : ''}
              </Button>
              <Button variant="outlined" size="small" startIcon={<RefineIcon />} onClick={handleRefineApply} disabled={refineFilterCount === 0 && !refineHasChanges}>
                Apply Refine
              </Button>
            </Box>
          </Collapse>
        </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3 }}>
        <Button onClick={onClose} variant="outlined" size="small">Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterModal;
