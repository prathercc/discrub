import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  ListSubheader,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import TourSpot from '@components/welcome/TourSpot';
import { applyPreset, selectExport } from '@features/export/exportSlice';
import {
  removePreset,
  savePreset,
  selectUserPresets,
} from '@features/presets/presetsSlice';
import { BUILT_IN_PRESETS, PRESET_CATEGORIES } from '@features/export/exportTypes';
import type { ExportPreset, ExportSettingsSnapshot } from '@features/export/exportTypes';

function snapshotMatches(a: ExportSettingsSnapshot, b: ExportSettingsSnapshot): boolean {
  return (
    a.format === b.format &&
    a.messagesPerPage === b.messagesPerPage &&
    a.separateThreads === b.separateThreads &&
    a.includeMedia === b.includeMedia &&
    a.mediaConfig.images === b.mediaConfig.images &&
    a.mediaConfig.videos === b.mediaConfig.videos &&
    a.mediaConfig.audio === b.mediaConfig.audio &&
    a.mediaConfig.other === b.mediaConfig.other &&
    a.artistMode === b.artistMode &&
    a.sortOrder === b.sortOrder &&
    a.previewMedia === b.previewMedia
  );
}

function exportStateToSnapshot(state: ReturnType<typeof selectExport>): ExportSettingsSnapshot {
  return {
    format: state.exportFormat,
    messagesPerPage: state.messagesPerPage,
    separateThreads: state.separateThreads,
    includeMedia: state.includeMedia,
    mediaConfig: { ...state.mediaConfig },
    artistMode: state.artistMode,
    sortOrder: state.sortOrder,
    previewMedia: state.previewMedia,
  };
}

const FORMAT_LABELS: Record<string, string> = {
  html: 'HTML',
  csv: 'CSV',
  json: 'JSON',
  media: 'Media Only',
};

function buildPresetSummary(preset: ExportSettingsSnapshot): string {
  const parts: string[] = [];

  parts.push(FORMAT_LABELS[preset.format] || preset.format.toUpperCase());

  if (preset.includeMedia) {
    const { images, videos, audio, other } = preset.mediaConfig;
    if (images && videos && audio && other) {
      parts.push('All media');
    } else if (images && !videos && !audio && !other) {
      parts.push('Images only');
    } else {
      const types = [images && 'img', videos && 'vid', audio && 'audio', other && 'files'].filter(Boolean);
      parts.push(types.join('+'));
    }
  } else if (preset.format !== 'media') {
    parts.push('No media');
  }

  if (preset.separateThreads) parts.push('Threads');
  if (preset.artistMode) parts.push('Artist mode');

  return parts.join(' · ');
}

/**
 * Preset selector UX:
 *
 * - Dialog opens with no preset selected — state has already been
 *   initialized from the user's main settings. This gives a clean
 *   slate each session and avoids the stale "(Modified)" label when
 *   drifted settings from a past session don't match the preset.
 * - Selecting a preset applies its snapshot to state and shows the
 *   preset's name in the dropdown.
 * - Any subsequent edit to state clears the dropdown back to empty.
 *   There is no "(Modified)" suffix — if users want custom settings
 *   to persist, they must explicitly save them as a preset.
 */
const PresetSelector = () => {
  const dispatch = useAppDispatch();
  const exportState = useAppSelector(selectExport);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const userPresets = useAppSelector(selectUserPresets);

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...userPresets], [userPresets]);

  const selectedPreset = allPresets.find((p) => p.id === selectedPresetId);
  const currentSnapshot = useMemo(() => exportStateToSnapshot(exportState), [exportState]);

  // Auto-clear the dropdown when state drifts from the selected preset.
  // This replaces the previous "(Modified)" label — the dropdown just
  // goes back to empty, which is honest and removes the need for a
  // special "modified" concept at all.
  useEffect(() => {
    if (
      selectedPresetId &&
      selectedPreset &&
      !snapshotMatches(currentSnapshot, selectedPreset)
    ) {
      setSelectedPresetId('');
    }
  }, [currentSnapshot, selectedPresetId, selectedPreset]);

  const handleSelectPreset = (presetId: string) => {
    if (presetId === '__save__') {
      setNameDialogOpen(true);
      return;
    }

    setSelectedPresetId(presetId);
    const preset = allPresets.find((p) => p.id === presetId);
    if (preset) {
      dispatch(applyPreset(preset));
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: ExportPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      isBuiltIn: false,
      ...exportStateToSnapshot(exportState),
    };

    dispatch(savePreset(newPreset));

    // Select the new preset for the remainder of this dialog session.
    // It'll reset back to '' next open, consistent with built-ins.
    setSelectedPresetId(newPreset.id);
    setPresetName('');
    setNameDialogOpen(false);
  };

  const handleDeletePreset = (presetId: string) => {
    dispatch(removePreset(presetId));

    if (selectedPresetId === presetId) {
      setSelectedPresetId('');
    }
  };

  const subheaderSx = {
    bgcolor: 'background.paper',
    lineHeight: '24px',
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'primary.main',
    borderTop: '1px solid',
    borderColor: 'divider',
    mt: 0.5,
    pt: 0.5,
    '&:first-of-type': { borderTop: 'none', mt: 0 },
  } as const;

  const menuItemSx = { py: 0.5, minHeight: 'auto' } as const;

  // Build grouped menu items
  const menuItems = useMemo(() => {
    const items: React.ReactNode[] = [];

    // Built-in presets grouped by category
    for (const category of PRESET_CATEGORIES) {
      const categoryPresets = BUILT_IN_PRESETS.filter((p) => p.category === category);
      if (categoryPresets.length === 0) continue;

      items.push(
        <ListSubheader key={`cat-${category}`} sx={subheaderSx}>
          {category}
        </ListSubheader>
      );

      for (const preset of categoryPresets) {
        items.push(
          <MenuItem key={preset.id} value={preset.id} sx={menuItemSx}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, width: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{preset.name}</Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                {buildPresetSummary(preset)}
              </Typography>
            </Box>
          </MenuItem>
        );
      }
    }

    // Custom presets
    if (userPresets.length > 0) {
      items.push(
        <ListSubheader key="cat-custom" sx={subheaderSx}>
          Custom
        </ListSubheader>
      );

      for (const preset of userPresets) {
        items.push(
          <MenuItem key={preset.id} value={preset.id} sx={menuItemSx}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{preset.name}</Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                {buildPresetSummary(preset)}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePreset(preset.id);
              }}
              sx={{ ml: 1 }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </MenuItem>
        );
      }
    }

    // Save as Preset option
    items.push(
      <MenuItem key="__save__" value="__save__" sx={menuItemSx}>
        <Typography variant="body2" color="primary">Save as Preset...</Typography>
      </MenuItem>
    );

    return items;
  }, [userPresets]);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Select
          value={selectedPresetId}
          onChange={(e) => handleSelectPreset(e.target.value)}
          displayEmpty
          size="small"
          fullWidth
          renderValue={(value) => {
            if (!value) return <Typography color="text.secondary">Select a preset...</Typography>;
            const preset = allPresets.find((p) => p.id === value);
            if (!preset) return <Typography color="text.secondary">Select a preset...</Typography>;
            return preset.name;
          }}
        >
          {menuItems}
        </Select>
        <TourSpot stepKey="export-presets" size="compact" placement="left" />
      </Box>

      {/* Save Preset Name Dialog */}
      <Dialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save as Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSavePreset();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setNameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePreset} variant="contained" disabled={!presetName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PresetSelector;
