import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Alert,
  Stack,
  Typography,
} from '@mui/material';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectSettings, updateAllSettings, defaultSettings } from '@features/app/appSlice';
import { getDiscordService } from '@services/discordService';
import { validateSettings } from './settingsUtils';
import { OperationDelaysTab } from './tabs/OperationDelaysTab';
import { ExportPreferencesTab } from './tabs/ExportPreferencesTab';
import { UserDataTab } from './tabs/UserDataTab';
import { DisplayTab } from './tabs/DisplayTab';
import { PurgeTab } from './tabs/PurgeTab';
import ResetDiscrubButton from './ResetDiscrubButton';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 1.5 }}>{children}</Box>}
    </div>
  );
};

const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectSettings);
  const [formValues, setFormValues] = useState<AppSettings>(settings || defaultSettings);
  const [activeTab, setActiveTab] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync form values with Redux state when settings change or modal opens
  useEffect(() => {
    if (open) {
      setFormValues(settings || defaultSettings);
      setErrors([]);
    }
  }, [settings, open]);

  const handleChange = (key: DiscrubSetting, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Clear errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSave = async () => {
    // Validate settings
    const validationErrors = validateSettings(formValues);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      // Save settings to Redux and localStorage
      await dispatch(updateAllSettings(formValues)).unwrap();

      // Reinitialize Discord service with new settings
      getDiscordService(formValues);

      // Close modal
      onClose();
    } catch (error) {
      setErrors(['Failed to save settings. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormValues(defaultSettings);
    setErrors([]);
  };

  const handleClose = () => {
    // Reset form to current settings on cancel
    setFormValues(settings || defaultSettings);
    setErrors([]);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: 600,
        },
      }}
    >
      <DialogTitle>Settings</DialogTitle>
      <DialogContent sx={{ overflow: 'auto' }}>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Operation Delays" />
          <Tab label="Export Preferences" />
          <Tab label="User Data" />
          <Tab label="Display" />
          <Tab label="Purge Behavior" />
          <Tab label="Reset Discrub" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <OperationDelaysTab formValues={formValues} onChange={handleChange} />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <ExportPreferencesTab formValues={formValues} onChange={handleChange} />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <UserDataTab formValues={formValues} onChange={handleChange} />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <DisplayTab formValues={formValues} onChange={handleChange} />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <PurgeTab formValues={formValues} onChange={handleChange} />
        </TabPanel>

        <TabPanel value={activeTab} index={5}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Reset
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Clear all data Discrub stores in your browser. Useful if you're hitting persistent issues that signing out and back in doesn't fix. You'll be returned to the sign-in screen afterward.
            </Typography>
            <Box>
              <ResetDiscrubButton variant="button" />
            </Box>
          </Stack>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={handleReset} disabled={saving}>
          Reset to defaults
        </Button>
        <Button variant="outlined" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsModal;
