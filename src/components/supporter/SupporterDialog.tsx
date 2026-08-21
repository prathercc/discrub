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
  Link,
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
  FavoriteBorder as HeartIcon,
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

// Final links (products created 2026-08-19, hidden until launch):
// monthly goes to the membership tiers page ("Discrub Supporter" is
// the only tier), lifetime to the shop item's permanent direct link.
// Both URLs are stable across the products' draft/published states.
const KOFI_MONTHLY_URL = 'https://ko-fi.com/prathercc/tiers';
const KOFI_LIFETIME_URL = 'https://ko-fi.com/s/0b4f9b2bdf';

/**
 * The Themes and Supporter hub behind the toolbar gift button — the
 * one place for switching themes, supporting, and applying a key.
 * Everyone gets the full theme grid (instant apply, per-card eye
 * preview, locks on supporter themes). The dialog is structured as a
 * pinned header, a scrolling grid, and a pinned action footer, so the
 * support/key controls are always in view no matter the window height.
 * Non-supporters get the paste-a-key row and the Ko-fi button in that
 * footer; supporter keys arrive by email after joining on Ko-fi, so
 * the key itself is all we ever collect. Supporters get their badge,
 * name, expiry, and refresh/remove there instead, with the export
 * footer controls in the scrolling area under the grid.
 */
const SupporterDialog = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectSupporterDialogOpen);
  const keyStatus = useAppSelector(selectSupporterKeyStatus);
  const payload = useAppSelector(selectSupporterPayload);
  const claimInProgress = useAppSelector(selectSupporterClaimInProgress);
  const claimError = useAppSelector(selectSupporterClaimError);
  const themeSetting = useAppSelector(selectSetting(DiscrubSetting.APP_THEME_MODE)) || 'auto';
  const animationsSetting =
    useAppSelector(selectSetting(DiscrubSetting.APP_THEME_ANIMATIONS)) || 'true';

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
      <Box sx={{ px: 3, pt: 3, pb: 1, textAlign: 'center', position: 'relative', flexShrink: 0 }}>
        <DialogCloseIcon onClose={handleClose} label="Close Supporter dialog" />

        {isSupporter ? (
          <BadgeIcon sx={{ fontSize: 32, color: 'cta.main' }} />
        ) : (
          <PaletteIcon sx={{ fontSize: 32, color: 'cta.main' }} />
        )}
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isSupporter ? 'Thank you for supporting Discrub' : 'Themes'}
        </Typography>
        {!isSupporter && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
            }}
          >
            Your support unlocks a growing pack of cosmetic themes
            <HeartIcon sx={{ fontSize: 14, color: '#ff5e5b' }} />
          </Typography>
        )}

        {keyStatus === 'expired' && (
          <Typography
            variant="caption"
            sx={{ color: 'warning.main', display: 'block', mt: 1 }}
            data-testid="supporter-lapsed-note"
          >
            Your membership lapsed, so supporter themes have relocked. Paste a fresh
            key below to pick up where you left off.
          </Typography>
        )}
      </Box>

      <DialogContent sx={{ px: 3, pt: 1, pb: 2 }}>
        <Box data-testid="supporter-theme-showcase">
          <ThemeGrid
            value={themeSetting}
            onChange={handleThemePick}
            isSupporter={isSupporter}
            cardWidth={104}
            centered
          />
        </Box>

        <FormControlLabel
          sx={{ mt: 1.5, alignItems: 'flex-start' }}
          control={
            <Checkbox
              size="small"
              sx={{ mt: -0.5 }}
              checked={animationsSetting === 'true'}
              onChange={(e) =>
                dispatch(
                  updateSetting({
                    key: DiscrubSetting.APP_THEME_ANIMATIONS,
                    value: e.target.checked ? 'true' : 'false',
                  }),
                )
              }
              inputProps={{ 'data-testid': 'theme-animations-toggle' } as object}
            />
          }
          label={
            <Box>
              <Typography variant="body2">Theme animations</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Allow subtle animated accents on themes that include them.
              </Typography>
            </Box>
          }
        />

        {isSupporter && payload && (
          <>
            <Divider sx={{ my: 2 }} />
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
          </>
        )}
      </DialogContent>

      {/* Pinned action footer — always in view, never scrolled away. */}
      <Box
        data-testid="supporter-dialog-footer"
        sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        {isSupporter && payload ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box
              data-testid="supporter-status"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: (theme: Theme) => alpha(theme.palette.cta.main, 0.08),
                border: '1px solid',
                borderColor: (theme: Theme) => alpha(theme.palette.cta.main, 0.3),
              }}
            >
              <BadgeIcon sx={{ color: 'cta.main', fontSize: 32, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  Supporter key issued to {payload.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {expiryLabel}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                {payload.tier === 'monthly' && (
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefresh}
                    disabled={claimInProgress}
                    data-testid="supporter-refresh-key"
                  >
                    Refresh
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
                  Remove
                </Button>
              </Box>
            </Box>
            {payload.tier === 'monthly' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Your key renews automatically while your membership is active. Removing
                it stops that.
              </Typography>
            )}
            {claimError && (
              <Typography variant="caption" color="error" data-testid="supporter-claim-error">
                {claimError}
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
              <Typography variant="caption" color="error" data-testid="supporter-claim-error">
                {claimError}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Your key arrives from{' '}
              <Link
                href="mailto:keys@pratherbytecraft.com"
                sx={{ color: 'cta.main' }}
                data-testid="supporter-key-email-link"
              >
                keys@pratherbytecraft.com
              </Link>{' '}
              right after you join. Monthly keys renew automatically. Supporters can
              also reword, rebrand, or remove the footer on HTML exports.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                href={KOFI_MONTHLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={
                  <Box component="img" src="/kofi.svg" alt="" sx={{ width: 18, height: 18 }} />
                }
                sx={{
                  backgroundColor: '#ff5e5b',
                  color: '#fff',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 4px 16px rgba(255, 94, 91, 0.3)',
                  '&:hover': {
                    backgroundColor: '#e5524f',
                    boxShadow: '0 6px 24px rgba(255, 94, 91, 0.45)',
                  },
                }}
                data-testid="supporter-kofi-monthly"
              >
                Join monthly · $3
              </Button>
              <Button
                variant="contained"
                href={KOFI_LIFETIME_URL}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<BadgeIcon sx={{ fontSize: 18 }} />}
                sx={{
                  backgroundColor: '#ff5e5b',
                  color: '#fff',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 4px 16px rgba(255, 94, 91, 0.3)',
                  '&:hover': {
                    backgroundColor: '#e5524f',
                    boxShadow: '0 6px 24px rgba(255, 94, 91, 0.45)',
                  },
                }}
                data-testid="supporter-kofi-lifetime"
              >
                Lifetime · $25
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default SupporterDialog;
