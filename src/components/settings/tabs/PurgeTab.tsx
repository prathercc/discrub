import { Box, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Checkbox, Typography, Alert } from '@mui/material';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

interface PurgeTabProps {
  formValues: AppSettings;
  onChange: (key: DiscrubSetting, value: string) => void;
}

type DefaultPurgeMode = 'messages' | 'attachmentsOnly' | 'reactions';

const deriveMode = (formValues: AppSettings): DefaultPurgeMode => {
  if (formValues[DiscrubSetting.PURGE_MODE] === 'reactions') return 'reactions';
  if (formValues[DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY] === 'true') return 'attachmentsOnly';
  return 'messages';
};

export const PurgeTab = ({ formValues, onChange }: PurgeTabProps) => {
  const defaultMode = deriveMode(formValues);
  const retainAttachedMedia = formValues[DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA] === 'true';

  const handleModeChange = (nextMode: DefaultPurgeMode) => {
    if (nextMode === 'messages') {
      onChange(DiscrubSetting.PURGE_MODE, 'messages');
      onChange(DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY, 'false');
    } else if (nextMode === 'attachmentsOnly') {
      onChange(DiscrubSetting.PURGE_MODE, 'messages');
      onChange(DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY, 'true');
      // Attachments-only and retain-media are conceptually exclusive, so clear retain-media.
      if (retainAttachedMedia) {
        onChange(DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA, 'false');
      }
    } else {
      onChange(DiscrubSetting.PURGE_MODE, 'reactions');
      onChange(DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY, 'false');
    }
  };

  const retainMediaApplies = defaultMode === 'messages';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="warning">
        These settings control default behavior for purge operations.
        They can be overridden per-operation in the Purge dialog.
      </Alert>

      <FormControl component="fieldset">
        <FormLabel component="legend">Default purge mode</FormLabel>
        <RadioGroup
          value={defaultMode}
          onChange={(e) => handleModeChange(e.target.value as DefaultPurgeMode)}
        >
          <FormControlLabel value="messages" control={<Radio />} label="Delete Messages" />
          <FormControlLabel value="attachmentsOnly" control={<Radio />} label="Strip Attachments Only" />
          <FormControlLabel value="reactions" control={<Radio />} label="Remove Reactions" />
        </RadioGroup>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Strip Attachments Only removes media but preserves the message text.
        </Typography>
      </FormControl>

      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={retainAttachedMedia}
              disabled={!retainMediaApplies}
              onChange={(e) =>
                onChange(DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA, e.target.checked ? 'true' : 'false')
              }
            />
          }
          label="Clear text, keep attachments"
        />
        <Typography variant="caption" sx={{ mt: -0.5, ml: 4, display: 'block', color: 'text.secondary' }}>
          For messages with attachments, strips the text content and preserves the media instead of deleting the whole message. Only applies to Delete Messages mode, and only works on messages you authored.
        </Typography>
      </Box>
    </Box>
  );
};
