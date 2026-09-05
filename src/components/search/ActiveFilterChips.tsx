import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as RefineIcon,
} from '@mui/icons-material';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { IsPinnedType } from 'discrub-core/discord-enum';
import { t as translate } from '@/i18n';
import { useTranslation } from 'react-i18next';

interface ActiveFilterChipsProps {
  searchCriteria: SearchCriteria;
  refineCriteria: SearchCriteria;
  onClearSearchFilter: (field: keyof SearchCriteria, value?: string) => void;
  onClearRefineFilter: (field: keyof SearchCriteria, value?: string) => void;
  onClearAll: () => void;
}

interface ChipData {
  key: string;
  label: string;
  field: keyof SearchCriteria;
  value?: string;
  layer: 'search' | 'refine';
}

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return dateStr;
  }
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${timeStr}`;
};

const buildChipsFromCriteria = (criteria: SearchCriteria, layer: 'search' | 'refine'): ChipData[] => {
  const chips: ChipData[] = [];

  criteria.userIds.forEach((id) => {
    chips.push({ key: `${layer}-from-${id}`, label: translate('filters.chip.from', { value: id }), field: 'userIds', value: id, layer });
  });

  criteria.selectedHasTypes.forEach((type) => {
    chips.push({ key: `${layer}-has-${type}`, label: translate('filters.chip.has', { value: translate(`filters.hasType.${type}`, { defaultValue: type }) }), field: 'selectedHasTypes', value: type, layer });
  });

  if (criteria.searchAfterDate) {
    chips.push({ key: `${layer}-after`, label: translate('filters.chip.after', { value: formatDate(criteria.searchAfterDate) }), field: 'searchAfterDate', layer });
  }

  if (criteria.searchBeforeDate) {
    chips.push({ key: `${layer}-before`, label: translate('filters.chip.before', { value: formatDate(criteria.searchBeforeDate) }), field: 'searchBeforeDate', layer });
  }

  if (criteria.isPinned !== IsPinnedType.UNSET) {
    chips.push({ key: `${layer}-pinned`, label: translate('filters.chip.pinned', { value: criteria.isPinned }), field: 'isPinned', layer });
  }

  if (criteria.authorType) {
    chips.push({ key: `${layer}-author`, label: translate('filters.chip.author', { value: criteria.authorType }), field: 'authorType', layer });
  }

  criteria.searchMessageContents?.forEach((term) => {
    chips.push({ key: `${layer}-content-${term}`, label: translate('filters.chip.content', { value: term }), field: 'searchMessageContents', value: term, layer });
  });

  criteria.attachmentExtensions?.forEach((ext) => {
    chips.push({ key: `${layer}-ext-${ext}`, label: translate('filters.chip.fileType', { value: ext }), field: 'attachmentExtensions', value: ext, layer });
  });

  if (criteria.attachmentFilename) {
    chips.push({ key: `${layer}-filename`, label: translate('filters.chip.fileName', { value: criteria.attachmentFilename }), field: 'attachmentFilename', layer });
  }

  criteria.mentionIds?.forEach((id) => {
    chips.push({ key: `${layer}-mentions-${id}`, label: translate('filters.chip.mentions', { value: id }), field: 'mentionIds', value: id, layer });
  });

  return chips;
};

/**
 * ActiveFilterChips - dual-layer chip bar showing search (blurple) and refine (gray) filters
 */
const ActiveFilterChips = ({ searchCriteria, refineCriteria, onClearSearchFilter, onClearRefineFilter, onClearAll }: ActiveFilterChipsProps) => {
  const { t } = useTranslation();
  const searchChips = buildChipsFromCriteria(searchCriteria, 'search');
  const refineChips = buildChipsFromCriteria(refineCriteria, 'refine');
  const allChips = [...searchChips, ...refineChips];

  if (allChips.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
      {allChips.map((chip) => {
        const isSearch = chip.layer === 'search';
        return (
          <Chip
            key={chip.key}
            icon={isSearch ? <SearchIcon sx={{ fontSize: '14px !important' }} /> : <RefineIcon sx={{ fontSize: '14px !important' }} />}
            label={chip.label}
            size="small"
            variant={isSearch ? 'filled' : 'outlined'}
            color={isSearch ? 'primary' : 'default'}
            onDelete={() => {
              if (isSearch) {
                onClearSearchFilter(chip.field, chip.value);
              } else {
                onClearRefineFilter(chip.field, chip.value);
              }
            }}
            sx={{
              height: 22,
              fontSize: '0.72rem',
              maxWidth: 220,
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        );
      })}
      <Tooltip title={t('filters.clearAll')}>
        <IconButton size="small" onClick={onClearAll} sx={{ width: 22, height: 22 }} aria-label={t('filters.clearAll')}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default ActiveFilterChips;
