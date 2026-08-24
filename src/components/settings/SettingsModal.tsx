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
import {
  selectHotkeys,
  setAllHotkeys,
} from '@features/hotkeys/hotkeysSlice';
import type { HotkeysState } from '@features/hotkeys/types';
import { getDiscordService } from '@services/discordService';
import { validateSettings } from './settingsUtils';
import { OperationDelaysTab } from './tabs/OperationDelaysTab';
import { ExportPreferencesTab } from './tabs/ExportPreferencesTab';
import { UserDataTab } from './tabs/UserDataTab';
import { DisplayTab } from './tabs/DisplayTab';
import { PurgeTab } from './tabs/PurgeTab';
import { HotkeysTab } from './tabs/HotkeysTab';
import ResetDiscrubButton from './ResetDiscrubButton';
import { forgetRememberedToken, selectTokenRemembered } from '@features/auth/authSlice';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import { hasUnsavedSettingsChanges } from './dirtyDetection';
import { useFullScreenDialog } from '@/hooks/useFullScreenDialog';

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
  const tokenRemembered = useAppSelector(selectTokenRemembered);
  const hotkeys = useAppSelector(selectHotkeys);
  const [formValues, setFormValues] = useState<AppSettings>(settings || defaultSettings);
  // Hotkeys live in their own slice with immediate-apply thunks, but
  // the dialog batches edits the same way it batches AppSettings:
  // changes accumulate locally until "Save Settings" commits both at
  // once. Single Save story across the whole modal (#144 follow-up
  // to remove the per-row Save buttons).
  const [formHotkeys, setFormHotkeys] = useState<HotkeysState>(hotkeys);
  const [activeTab, setActiveTab] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Discard-confirmation dialog state (#164). Shown only when the
  // user attempts to close while there are unsaved edits — otherwise
  // close skips the prompt entirely so the typical "open, peek, close"
  // flow stays one click.
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);

  // Sync form values with Redux state when settings change or modal opens
  useEffect(() => {
    if (open) {
      setFormValues(settings || defaultSettings);
      setFormHotkeys(hotkeys);
      setErrors([]);
    }
  }, [settings, hotkeys, open]);

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

      // Save hotkeys batch — same Save click, single commit point.
      await dispatch(setAllHotkeys(formHotkeys)).unwrap();

      // Reinitialize Discord service with new settings
      getDiscordService(formValues);

      // Close modal
      onClose();
    } catch {
      setErrors(['Failed to save settings. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Theme choices live in the Themes hub, not this form, so a bulk
    // reset must not silently revert them through the batch save.
    setFormValues({
      ...defaultSettings,
      [DiscrubSetting.APP_THEME_MODE]:
        formValues[DiscrubSetting.APP_THEME_MODE] ?? defaultSettings[DiscrubSetting.APP_THEME_MODE],
      [DiscrubSetting.APP_THEME_ANIMATIONS]:
        formValues[DiscrubSetting.APP_THEME_ANIMATIONS] ??
        defaultSettings[DiscrubSetting.APP_THEME_ANIMATIONS],
    });
    setErrors([]);
  };

  // Actually discard edits + close. Routed through whenever close is
  // approved (no unsaved edits, or user clicked Discard in the prompt).
  const performClose = () => {
    setFormValues(settings || defaultSettings);
    setFormHotkeys(hotkeys);
    setErrors([]);
    setDiscardPromptOpen(false);
    onClose();
  };

  // Public close-request entry point. Wired to Cancel, the X icon,
  // backdrop click, and Esc — every close path except a successful
  // Save Settings (which calls onClose() directly after the dispatch
  // succeeds, bypassing the dirty check because the changes were
  // saved, not discarded).
  const handleClose = () => {
    const dirty = hasUnsavedSettingsChanges({
      formValues,
      settings: settings || defaultSettings,
      formHotkeys,
      hotkeys,
    });
    if (dirty) {
      setDiscardPromptOpen(true);
      return;
    }
    performClose();
  };

  const fullScreen = useFullScreenDialog();
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        sx: fullScreen ? undefined : { height: '80vh', maxHeight: 600 },
      }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        Settings
        <DialogCloseIcon onClose={handleClose} disabled={saving} />
      </DialogTitle>
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
          <Tab label="Hotkeys" />
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
          <HotkeysTab formHotkeys={formHotkeys} onHotkeysChange={setFormHotkeys} />
        </TabPanel>

        <TabPanel value={activeTab} index={6}>
          {tokenRemembered && (
            <Stack spacing={2} sx={{ pt: 1, pb: 3 }} data-testid="settings-saved-token">
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Saved token
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your Discord token is saved on this device so you stay signed in between visits. Forgetting it keeps this session signed in; you'll paste the token again next time.
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  onClick={() => dispatch(forgetRememberedToken())}
                  data-testid="settings-forget-token"
                >
                  Forget saved token
                </Button>
              </Box>
            </Stack>
          )}
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

      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, '& > :not(:first-of-type)': { ml: 0 } }}>
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

      <Dialog
        open={discardPromptOpen}
        onClose={() => setDiscardPromptOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You've made changes that haven't been saved. Closing now will
            discard them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardPromptOpen(false)} variant="outlined">
            Keep editing
          </Button>
          <Button onClick={performClose} variant="contained" color="error">
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default SettingsModal;
