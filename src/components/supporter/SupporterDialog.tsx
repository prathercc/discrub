import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  FormControlLabel,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  Palette as PaletteIcon,
  WorkspacePremium as BadgeIcon,
  Autorenew as RefreshIcon,
  DeleteOutline as RemoveIcon,
  FileUpload as UploadIcon,
} from '@mui/icons-material';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectSetting, updateSetting, setPreviewThemeId } from '@features/app/appSlice';
import {
  selectSupporterDialogOpen,
  selectSupporterKeyStatus,
  selectSupporterPayload,
  selectSupporterClaimInProgress,
  selectSupporterClaimError,
  selectSupporterFooter,
  setSupporterDialogOpen,
  refreshSupporterKey,
  applyPastedSupporterKey,
  removeSupporterKey,
  updateFooterPreferences,
  setFooterIcon,
} from '@features/supporter/supporterSlice';
import {
  DEFAULT_FOOTER_TEXT,
  FOOTER_TEXT_MAX_LENGTH,
  FOOTER_ICON_ACCEPTED_TYPES,
  processFooterIconFile,
} from '@services/exportFooter';
import { ThemeGrid } from '@components/settings/tabs/ThemePicker';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

const KOFI_URL = 'https://ko-fi.com/prathercc';

/**
 * The Themes and Supporter hub behind the toolbar gift button — the
 * one place for switching themes, supporting, and applying a key.
 * Everyone gets the full theme grid (instant apply, hover preview,
 * locks on supporter themes). Non-supporters also see the Ko-fi
 * button and the paste-a-key box; supporter keys arrive by email
 * after joining on Ko-fi, so the key itself is all we ever collect.
 * Supporters see their badge, name, and expiry, plus refresh/remove
 * and the export footer controls.
 */
const SupporterDialog = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectSupporterDialogOpen);
  const keyStatus = useAppSelector(selectSupporterKeyStatus);
  const payload = useAppSelector(selectSupporterPayload);
  const claimInProgress = useAppSelector(selectSupporterClaimInProgress);
  const claimError = useAppSelector(selectSupporterClaimError);
  const themeSetting = useAppSelector(selectSetting(DiscrubSetting.APP_THEME_MODE)) || 'auto';

  const footer = useAppSelector(selectSupporterFooter);

  const [pastedKey, setPastedKey] = useState('');
  const [footerTextDraft, setFooterTextDraft] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const isSupporter = keyStatus === 'valid';

  const handleClose = () => {
    // Theme picks in the hub apply instantly, so the preview must not
    // outlive the dialog.
    dispatch(setPreviewThemeId(null));
    dispatch(setSupporterDialogOpen(false));
  };

  const handleThemePick = (id: string) => {
    dispatch(updateSetting({ key: DiscrubSetting.APP_THEME_MODE, value: id }));
  };

  const handlePasteApply = () => {
    if (!pastedKey.trim() || claimInProgress) return;
    dispatch(applyPastedSupporterKey(pastedKey));
  };

  const handleRefresh = () => {
    if (claimInProgress) return;
    dispatch(refreshSupporterKey());
  };

  const commitFooterText = () => {
    if (footerTextDraft === null) return;
    dispatch(updateFooterPreferences({ text: footerTextDraft }));
    setFooterTextDraft(null);
  };

  const handleIconFile = async (file: File | undefined) => {
    if (!file) return;
    setIconError(null);
    try {
      const dataUri = await processFooterIconFile(file);
      dispatch(setFooterIcon(dataUri));
    } catch (error) {
      setIconError(error instanceof Error ? error.message : 'That image could not be used.');
    }
    if (iconInputRef.current) iconInputRef.current.value = '';
  };

  const expiryLabel = (() => {
    if (!payload) return '';
    if (payload.tier === 'lifetime') return 'Lifetime supporter';
    if (payload.exp === null) return 'Monthly supporter';
    const date = new Date(payload.exp * 1000).toLocaleDateString();
    return keyStatus === 'expired'
      ? `Membership lapsed ${date}`
      : `Monthly supporter, key valid through ${date}`;
  })();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper' }, 'data-testid': 'supporter-dialog' } as object}
    >
      <DialogContent sx={{ py: 4, px: 3, position: 'relative' }}>
        <DialogCloseIcon onClose={handleClose} label="Close Supporter dialog" />

        <Box sx={{ textAlign: 'center', mb: 2 }}>
          {isSupporter ? (
            <BadgeIcon sx={{ fontSize: 40, color: 'cta.main', mb: 1 }} />
          ) : (
            <PaletteIcon sx={{ fontSize: 40, color: 'cta.main', mb: 1 }} />
          )}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isSupporter ? 'Thank you for supporting Discrub' : 'Themes'}
          </Typography>
          {!isSupporter && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Supporting unlocks a growing pack of cosmetic themes as a thank you.
            </Typography>
          )}
        </Box>

        {keyStatus === 'expired' && (
          <Typography
            variant="caption"
            sx={{ color: 'warning.main', textAlign: 'center', display: 'block', mb: 1.5 }}
            data-testid="supporter-lapsed-note"
          >
            Your membership lapsed, so supporter themes have relocked. Paste a fresh
            key below to pick up where you left off.
          </Typography>
        )}

        <Box data-testid="supporter-theme-showcase" sx={{ mb: 2 }}>
          <ThemeGrid
            value={themeSetting}
            onChange={handleThemePick}
            isSupporter={isSupporter}
            onLockedClick={() => {}}
            cardWidth={104}
            centered
          />
        </Box>

        {isSupporter && payload ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              data-testid="supporter-status"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                borderRadius: 1.5,
                bgcolor: (theme: Theme) => alpha(theme.palette.cta.main, 0.08),
                border: '1px solid',
                borderColor: (theme: Theme) => alpha(theme.palette.cta.main, 0.3),
              }}
            >
              <BadgeIcon sx={{ color: 'cta.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Supporter key issued to {payload.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {expiryLabel}
                </Typography>
              </Box>
            </Box>

            {payload.tier === 'monthly' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Your key renews automatically while your membership is active. Removing
                it stops that.
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              {payload.tier === 'monthly' && (
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  disabled={claimInProgress}
                  data-testid="supporter-refresh-key"
                >
                  Refresh key
                </Button>
              )}
              <Button
                size="small"
                color="error"
                startIcon={<RemoveIcon />}
                onClick={() => dispatch(removeSupporterKey())}
                disabled={claimInProgress}
                data-testid="supporter-remove-key"
              >
                Remove key
              </Button>
            </Box>
            {claimError && (
              <Typography variant="caption" color="error" data-testid="supporter-claim-error">
                {claimError}
              </Typography>
            )}

            <Divider />

            <Box data-testid="supporter-footer-controls">
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Export footer
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                HTML exports carry a small footer line. As a supporter you can reword it,
                give it your own icon, or turn it off.
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={!footer.removed}
                    onChange={(e) =>
                      dispatch(updateFooterPreferences({ removed: !e.target.checked }))
                    }
                    inputProps={{ 'data-testid': 'supporter-footer-enabled' } as object}
                  />
                }
                label={<Typography variant="body2">Include the footer in exports</Typography>}
              />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                <TextField
                  size="small"
                  label="Footer text"
                  placeholder={DEFAULT_FOOTER_TEXT}
                  value={footerTextDraft ?? footer.text ?? ''}
                  onChange={(e) => setFooterTextDraft(e.target.value)}
                  onBlur={commitFooterText}
                  onKeyDown={(e) => e.key === 'Enter' && commitFooterText()}
                  disabled={footer.removed}
                  inputProps={
                    {
                      'data-testid': 'supporter-footer-text',
                      maxLength: FOOTER_TEXT_MAX_LENGTH,
                    } as object
                  }
                  helperText="Leave blank for the default line"
                  fullWidth
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {footer.iconDataUri ? (
                    <Box
                      component="img"
                      src={footer.iconDataUri}
                      alt="Custom footer icon"
                      data-testid="supporter-footer-icon-preview"
                      sx={{ width: 32, height: 32, borderRadius: 1, flexShrink: 0 }}
                    />
                  ) : (
                    <Box
                      component="img"
                      src="/icons/icon-48.png"
                      alt="Default Discrub footer icon"
                      sx={{ width: 32, height: 32, borderRadius: 1, flexShrink: 0, opacity: 0.7 }}
                    />
                  )}
                  <Button
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={() => iconInputRef.current?.click()}
                    disabled={footer.removed}
                    data-testid="supporter-footer-upload"
                  >
                    Custom icon
                  </Button>
                  {footer.iconDataUri && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => dispatch(setFooterIcon(null))}
                      data-testid="supporter-footer-icon-remove"
                    >
                      Use default
                    </Button>
                  )}
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept={FOOTER_ICON_ACCEPTED_TYPES.join(',')}
                    style={{ display: 'none' }}
                    data-testid="supporter-footer-icon-input"
                    onChange={(e) => handleIconFile(e.target.files?.[0])}
                  />
                </Box>
                {iconError && (
                  <Typography variant="caption" color="error" data-testid="supporter-footer-icon-error">
                    {iconError}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                href={KOFI_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ bgcolor: 'cta.main', '&:hover': { bgcolor: 'cta.dark' } }}
                data-testid="supporter-kofi-button"
              >
                Support on Ko-fi
              </Button>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Have a supporter key?
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Your key arrives by email right after you join on Ko-fi. Paste it here
                and the supporter themes unlock instantly. Monthly keys renew
                automatically while your membership is active.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  label="Supporter key"
                  placeholder="DSCRB-..."
                  value={pastedKey}
                  onChange={(e) => setPastedKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasteApply()}
                  inputProps={{ 'data-testid': 'supporter-paste-key' } as object}
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handlePasteApply}
                  disabled={!pastedKey.trim() || claimInProgress}
                  startIcon={claimInProgress ? <CircularProgress size={16} /> : undefined}
                  data-testid="supporter-paste-apply"
                >
                  Apply
                </Button>
              </Box>
              {claimError && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: 'block', mt: 1 }}
                  data-testid="supporter-claim-error"
                >
                  {claimError}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupporterDialog;
