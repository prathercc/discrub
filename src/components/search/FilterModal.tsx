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
  Chip,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as RefineIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import type { SearchCriteria, ExportUserMap } from 'discrub-core/types/discrub-types';
import DateRangeFilter, { type DateFilterMode } from './filters/DateRangeFilter';
import MessageTypeFilter from './filters/MessageTypeFilter';
import UserPicker from '@components/ui/UserPicker';
import TourFootnote from '@components/welcome/TourFootnote';
import PinnedFilter from './filters/PinnedFilter';
import AuthorTypeFilter from './filters/AuthorTypeFilter';
import SystemMessageTypePicker from '@components/message/SystemMessageTypePicker';
import { defaultCriteria } from './searchConstants';
import type { AuthorType } from 'discrub-core/discord-enum';
import { countActiveFilters } from 'discrub-core/filtering';
import type { RefineCriteria, SystemMessageRefineMode } from '@features/message/messageFiltering';

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  onServerSearch: (criteria: SearchCriteria) => void;
  onRefine: (criteria: RefineCriteria) => void;
  onClearSearch: () => void;
  onClearRefine: () => void;
  savedSearchCriteria?: SearchCriteria;
  savedRefineCriteria?: RefineCriteria;
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
  // When true, hides the "From" UserPicker and "Author Type" filter in
  // the Search section (#137). Use when the parent dialog has already
  // locked the message-author concept to the current user — e.g. DM
  // Messages Purge / DM Attachments Only Purge — so the filters can't
  // contradict the lock and produce confusing 0-result searches.
  // Reactions modes should NOT pass true: their target is the reactor,
  // and the message-author filter remains independently useful.
  hideAuthorFilters?: boolean;
  // When true, strips the modal down to the fields evaluable against a
  // raw `PackageMessage` (#172): keeps Content + Date range, hides
  // Mentions / Has / Author Type / Pinned / From, and forces the Refine
  // section off. Reactions, pinned, mentions, and the per-author filters
  // require Tier 2 rehydration data and would silently produce 0-row
  // results against package-only data — better to remove them from the
  // surface entirely than to leave dead controls.
  packageMode?: boolean;
}

// #195 cluster A: countActiveFilters/countTotalFilters moved to
// discrub-core/filtering. Transitive consumers (BulkPurgeDialog,
// ServerView, BulkExportDialog) updated to import from the lib
// directly; no FilterModal re-export needed.

export const inferDateMode = (c?: SearchCriteria): DateFilterMode => {
  if (!c) return null;
  const hasAfter = !!c.searchAfterDate;
  const hasBefore = !!c.searchBeforeDate;
  if (!hasAfter && !hasBefore) return null;
  if (hasAfter && !hasBefore) return 'after';
  if (hasBefore && !hasAfter) return 'before';
  // Both bounds set. Treat as a "During" single-day filter only when the
  // bounds match the startOfDay/endOfDay pair that handleDuringDateChange
  // emits for one calendar day; otherwise it's a between-range.
  const after = c.searchAfterDate as Date;
  const before = c.searchBeforeDate as Date;
  const sameDay =
    after.getFullYear() === before.getFullYear() &&
    after.getMonth() === before.getMonth() &&
    after.getDate() === before.getDate();
  const isStartOfDay =
    after.getHours() === 0 &&
    after.getMinutes() === 0 &&
    after.getSeconds() === 0;
  const isEndOfDay =
    before.getHours() === 23 &&
    before.getMinutes() === 59 &&
    before.getSeconds() === 59;
  return sameDay && isStartOfDay && isEndOfDay ? 'during' : 'between';
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
  hideAuthorFilters = false,
  packageMode = false,
}: FilterModalProps) => {
  // Package data exposes only Content + Date Range — every other field
  // requires Tier 2 rehydration. Force off the Refine section + author
  // filters when packageMode is on.
  const effectiveHideRefineSection = hideRefineSection || packageMode;
  const effectiveHideAuthorFilters = hideAuthorFilters || packageMode;
  // Search section state
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>(savedSearchCriteria ?? defaultCriteria);
  const [dateMode, setDateMode] = useState<DateFilterMode>(inferDateMode(savedSearchCriteria));
  const [searchExpanded, setSearchExpanded] = useState(true);

  // Refine section state
  const [refineCriteria, setRefineCriteria] = useState<RefineCriteria>(savedRefineCriteria ?? defaultCriteria);
  const [refineExpanded, setRefineExpanded] = useState(true);

  const updateSearchCriteria = (updater: SearchCriteria | ((prev: SearchCriteria) => SearchCriteria)) => {
    setSearchCriteria((prev) => typeof updater === 'function' ? updater(prev) : updater);
  };

  const updateRefineCriteria = (updater: RefineCriteria | ((prev: RefineCriteria) => RefineCriteria)) => {
    setRefineCriteria((prev) => typeof updater === 'function' ? updater(prev) : updater);
  };

  const searchFilterCount = useMemo(() => countActiveFilters(searchCriteria), [searchCriteria]);
  // #201: the system-message refine filter isn't part of the lib SearchCriteria
  // counters, so add it explicitly — otherwise a system-only refine would read
  // as "0 filters" and handleRefineApply would clear instead of apply.
  const refineFilterCount = useMemo(() => {
    const base = countActiveFilters(refineCriteria);
    const sys = refineCriteria.systemMessageGroups && refineCriteria.systemMessageGroups.length > 0 ? 1 : 0;
    return base + sys;
  }, [refineCriteria]);

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
      <DialogTitle sx={{ pr: 5 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          Filters
        </Typography>
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2, px: 2, overflowY: 'auto' }}>
        {/* ═══ SEARCH SECTION ═══ */}
        <Box sx={sectionContainerSx(true)}>
          {/* Collapsible header */}
          <Box sx={sectionHeaderSx(true)} onClick={() => setSearchExpanded(!searchExpanded)}>
            <SearchIcon sx={(theme) => ({ fontSize: 18, color: theme.palette.primary.main })} />
            <Typography variant="subtitle2" sx={(theme) => ({ fontWeight: 700, color: theme.palette.primary.main, flex: 1 })}>
              {packageMode ? 'Refine' : 'Search'}
            </Typography>
            {searchFilterCount > 0 && (
              <Chip label={searchFilterCount} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem', minWidth: 20 }} />
            )}
            {!packageMode && (
              <Chip label="Discord API" size="small" variant="outlined" color="primary" sx={{ height: 18, fontSize: '0.55rem' }} />
            )}
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

              {!effectiveHideAuthorFilters && (
                <Box data-testid="filter-modal-search-from">
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>From</Typography>
                  <UserPicker selectedUserIds={searchCriteria.userIds} onChange={(ids) => updateSearchCriteria((p) => ({ ...p, userIds: ids }))} cachedUserMap={cachedUserMap} currentUserId={currentUserId} label="" />
                </Box>
              )}

              {!packageMode && (
                <MessageTypeFilter selectedTypes={searchCriteria.selectedHasTypes} onChange={(types) => updateSearchCriteria((p) => ({ ...p, selectedHasTypes: types }))} />
              )}

              {!packageMode && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>Mentions</Typography>
                  <UserPicker selectedUserIds={searchCriteria.mentionIds || []} onChange={(ids) => updateSearchCriteria((p) => ({ ...p, mentionIds: ids }))} cachedUserMap={cachedUserMap} currentUserId={currentUserId} label="" />
                </Box>
              )}

              <DateRangeFilter
                startDate={searchCriteria.searchAfterDate || null}
                endDate={searchCriteria.searchBeforeDate || null}
                onStartDateChange={(d) => updateSearchCriteria((p) => ({ ...p, searchAfterDate: d }))}
                onEndDateChange={(d) => updateSearchCriteria((p) => ({ ...p, searchBeforeDate: d }))}
                dateMode={dateMode}
                onDateModeChange={setDateMode}
              />

              {!effectiveHideAuthorFilters && (
                <Box data-testid="filter-modal-search-author-type">
                  <AuthorTypeFilter value={searchCriteria.authorType} onChange={(v: AuthorType | null) => updateSearchCriteria((p) => ({ ...p, authorType: v }))} />
                </Box>
              )}

              {!packageMode && (
                <PinnedFilter value={searchCriteria.isPinned} onChange={(v) => updateSearchCriteria((p) => ({ ...p, isPinned: v }))} />
              )}
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
        {!effectiveHideRefineSection && (
        <Box sx={sectionContainerSx(false)}>
          {/* Collapsible header */}
          <Box sx={sectionHeaderSx(false)} onClick={() => setRefineExpanded(!refineExpanded)}>
            <RefineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', flex: 1 }}>
              Refine
              <Box component="span" onClick={(e) => e.stopPropagation()}>
                <TourFootnote stepKey="refine-section" />
              </Box>
            </Typography>
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

              {/* #201 — system-message type filter (client-side only; the
                  Discord search API has no MessageType param, so it lives in
                  Refine). Reuses the same 7-bucket picker as the purge dialog. */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>System Messages</Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={refineCriteria.systemMessageMode ?? 'only'}
                    onChange={(_, mode: SystemMessageRefineMode | null) => {
                      if (mode) updateRefineCriteria((p) => ({ ...p, systemMessageMode: mode }));
                    }}
                  >
                    <ToggleButton value="only" sx={{ textTransform: 'none', py: 0.25 }}>Show only</ToggleButton>
                    <ToggleButton value="hide" sx={{ textTransform: 'none', py: 0.25 }}>Hide</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <SystemMessageTypePicker
                  selectedGroups={refineCriteria.systemMessageGroups ?? []}
                  onChange={(groups) => updateRefineCriteria((p) => ({ ...p, systemMessageGroups: groups }))}
                />
              </Box>
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
