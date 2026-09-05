import { useState } from 'react';
import { Box, Chip, TextField, Typography } from '@mui/material';
import { AttachFile as AttachFileIcon } from '@mui/icons-material';
import { normalizeAttachmentExtension } from 'discrub-core/filtering';
import { useTranslation } from 'react-i18next';

interface AttachmentFilterProps {
  extensions: string[];
  filename: string | null | undefined;
  onExtensionsChange: (extensions: string[]) => void;
  onFilenameChange: (filename: string | null) => void;
  /**
   * 'search' rides Discord's `attachment_extension` / `attachment_filename`
   * params (filename is an exact, case-sensitive match on the server).
   * 'refine' filters loaded messages locally (filename is a substring).
   * Only the helper copy differs; the criteria shape is the same.
   */
  mode: 'search' | 'refine';
  /** Called on Enter in the filename box so the section can apply. */
  onSubmit?: () => void;
}

/**
 * AttachmentFilter (GH #13): file-extension chips (any-of) plus a filename
 * box. Extensions are normalized as they are added ("  .PNG " → "png") so
 * what the chip shows is exactly what goes on the wire.
 */
const AttachmentFilter = ({
  extensions,
  filename,
  onExtensionsChange,
  onFilenameChange,
  mode,
  onSubmit,
}: AttachmentFilterProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const parts = draft
      .split(/[,\s]+/)
      .map(normalizeAttachmentExtension)
      .filter((ext) => ext.length > 0 && !extensions.includes(ext));
    if (parts.length > 0) onExtensionsChange([...extensions, ...parts]);
    setDraft('');
  };

  return (
    <Box data-testid={`attachment-filter-${mode}`}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {t('filters.attachments')}
      </Typography>
      {extensions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {extensions.map((ext) => (
            <Chip
              key={ext}
              label={ext}
              icon={<AttachFileIcon fontSize="small" />}
              size="small"
              color="primary"
              onDelete={() => onExtensionsChange(extensions.filter((e) => e !== ext))}
              sx={{ fontWeight: 500 }}
            />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder={t('filters.fileTypePlaceholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          inputProps={{ 'data-testid': `attachment-extension-input-${mode}`, 'aria-label': t('filters.attachmentFileType') }}
        />
        <TextField
          size="small"
          fullWidth
          placeholder={mode === 'search' ? t('filters.exactFileName') : t('filters.fileNameContains')}
          value={filename ?? ''}
          onChange={(e) => onFilenameChange(e.target.value || null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit?.();
          }}
          inputProps={{ 'data-testid': `attachment-filename-input-${mode}`, 'aria-label': t('filters.attachmentFileName') }}
          helperText={
            mode === 'search'
              ? t('filters.exactMatchHelp')
              : undefined
          }
        />
      </Box>
    </Box>
  );
};

export default AttachmentFilter;
