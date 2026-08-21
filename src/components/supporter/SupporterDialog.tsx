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
  IconButton,
  Link,
  TextField,
  Tooltip,
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
  CheckCircle as IncludedIcon,
  RadioButtonUnchecked as NotIncludedIcon,
  LockOutlined as LockIcon,
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
  selectSupporterLastRefreshAt,
  selectIsSupporter,
  selectHasThemes,
  setSupporterDialogOpen,
  refreshSupporterKey,
  applyPastedSupporterKey,
  removeSupporterKey,
  updateFooterPreferences,
  setFooterIcon,
} from '@features/supporter/supporterSlice';
import {
  isSupporterFeatureLive,
  SUPPORTER_FEATURES,
  type SupporterFeature,
} from '@services/supporterKeyService';
import {
  DEFAULT_FOOTER_TEXT,
  FOOTER_TEXT_MAX_LENGTH,
  FOOTER_ICON_ACCEPTED_TYPES,
  processFooterIconFile,
} from '@services/exportFooter';
import { ThemeGrid } from '@components/settings/tabs/ThemePicker';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

import {
  KOFI_MONTHLY_URL,
  KOFI_SUPPORTER_YEARLY_URL,
  KOFI_BLEEDING_EDGE_YEARLY_URL,
  HOSTED_URL,
} from '@services/kofiLinks';
import { useFullScreenDialog } from '@/hooks/useFullScreenDialog';

export { KOFI_MONTHLY_URL, KOFI_SUPPORTER_YEARLY_URL, KOFI_BLEEDING_EDGE_YEARLY_URL, HOSTED_URL };

const FEATURE_LABEL: Record<SupporterFeature, string> = {
  themes: 'Themes',
  hosted: 'Bleeding Edge',
};

const FEATURE_BLURB: Record<SupporterFeature, string> = {
  themes: 'Full theme pack in the app and in exports, animated accents, custom export footer',
  hosted: 'Hosted early-access build with new features before they clear store review',
};

const formatDate = (unix: number) => new Date(unix * 1000).toLocaleDateString();

const relativeTime = (ms: number | null): string => {
  if (ms === null) return 'Not checked yet';
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 2) return 'Checked just now';
  if (minutes < 60) return `Checked ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Checked ${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `Checked ${Math.round(hours / 24)} days ago`;
};

const kofiButtonSx = {
  backgroundColor: '#ff5e5b',
  color: '#fff',
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: '0 4px 16px rgba(255, 94, 91, 0.3)',
  '&:hover': {
    backgroundColor: '#e5524f',
    boxShadow: '0 6px 24px rgba(255, 94, 91, 0.45)',
  },
} as const;

/**
 * The Themes and Supporter hub behind the toolbar palette button: one
 * place for switching themes, supporting, and applying a key.
 *
 * Reading order (owner decision 2026-08-20): who you are and what you
 * have first, then the perks. Supporters see an access card directly
 * under the title (name, one row per feature, Refresh/Remove icon
 * buttons), then the theme grid, animations toggle, and export footer
 * controls. Non-supporters see the purchase grid and paste box first,
 * then the grid with locked previews, and the footer controls shown
 * disabled so the perk is visible rather than hidden. Nothing is
 * pinned; the dialog scrolls naturally.
 */
const SupporterDialog = () => {
  const dispatch = useAppDispatch();
  const fullScreen = useFullScreenDialog();
  const open = useAppSelector(selectSupporterDialogOpen);
  const keyStatus = useAppSelector(selectSupporterKeyStatus);
  const payload = useAppSelector(selectSupporterPayload);
  const claimInProgress = useAppSelector(selectSupporterClaimInProgress);
  const claimError = useAppSelector(selectSupporterClaimError);
  const lastRefreshAt = useAppSelector(selectSupporterLastRefreshAt);
  const isSupporter = useAppSelector(selectIsSupporter);
  const hasThemes = useAppSelector(selectHasThemes);
  const themeSetting = useAppSelector(selectSetting(DiscrubSetting.APP_THEME_MODE)) || 'auto';
  const animationsSetting =
    useAppSelector(selectSetting(DiscrubSetting.APP_THEME_ANIMATIONS)) || 'true';

  const footer = useAppSelector(selectSupporterFooter);

  const [pastedKey, setPastedKey] = useState('');
  const [footerTextDraft, setFooterTextDraft] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

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

  const featureLine = (feature: SupporterFeature): string => {
    if (!payload || !(feature in payload.ent)) return 'Not included';
    const exp = payload.ent[feature];
    if (exp === null) return 'Never expires';
    const live = keyStatus === 'valid' && isSupporterFeatureLive(payload, feature);
    return live ? `Through ${formatDate(exp as number)}` : `Ended ${formatDate(exp as number)}`;
  };

  const renewsAutomatically =
    payload !== null && Object.values(payload.ent).some((exp) => typeof exp === 'number');

  const footerControlsDisabled = !hasThemes;
  const footerRemoved = hasThemes && footer.removed;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
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
      </Box>

      <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
        {/* ---- Access (supporter) or purchase + paste (everyone else) ---- */}
        {payload && keyStatus !== 'none' && keyStatus !== 'invalid' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            <Box
              data-testid="supporter-status"
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: (theme: Theme) => alpha(theme.palette.cta.main, 0.08),
                border: '1px solid',
                borderColor: (theme: Theme) => alpha(theme.palette.cta.main, 0.3),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                  Supporter key issued to {payload.name}
                </Typography>
                <Tooltip title="Refresh now. Your key checks in on its own about once a day.">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleRefresh}
                      disabled={claimInProgress}
                      aria-label="Refresh key"
                      data-testid="supporter-refresh-key"
                    >
                      {claimInProgress ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Remove this key from this device. That also stops the daily check-in.">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => dispatch(removeSupporterKey())}
                      disabled={claimInProgress}
                      aria-label="Remove key"
                      data-testid="supporter-remove-key"
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              <Box
                component="ul"
                data-testid="supporter-access-list"
                sx={{ listStyle: 'none', m: 0, mt: 1, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}
              >
                {SUPPORTER_FEATURES.map((feature) => {
                  const live = keyStatus === 'valid' && isSupporterFeatureLive(payload, feature);
                  const included = feature in payload.ent;
                  return (
                    <Box
                      component="li"
                      key={feature}
                      data-testid={`supporter-access-${feature}`}
                      data-live={live ? 'true' : 'false'}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {live ? (
                        <IncludedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      ) : (
                        <NotIncludedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 600, width: 110, flexShrink: 0 }}>
                        {FEATURE_LABEL[feature]}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: live ? 'text.primary' : 'text.secondary', flex: 1, minWidth: 0 }}
                        noWrap
                      >
                        {featureLine(feature)}
                        {!included && (
                          <>
                            {' · '}
                            <Link
                              href={feature === 'hosted' ? KOFI_MONTHLY_URL : KOFI_MONTHLY_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: 'cta.main' }}
                              data-testid={`supporter-get-${feature}`}
                            >
                              Get it on Ko-fi
                            </Link>
                          </>
                        )}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 1 }}
                data-testid="supporter-checkin-note"
              >
                {relativeTime(lastRefreshAt)}.
                {renewsAutomatically
                  ? ' Renews automatically while your membership is active.'
                  : ''}
              </Typography>
            </Box>

            {keyStatus === 'expired' && (
              <Typography
                variant="caption"
                sx={{ color: 'warning.main' }}
                data-testid="supporter-lapsed-note"
              >
                Your supporter access has ended, so supporter perks have relocked. Hit
                Refresh after renewing, or paste a fresh key below.
              </Typography>
            )}
            {keyStatus === 'revoked' && (
              <Typography variant="caption" sx={{ color: 'warning.main' }} data-testid="supporter-revoked-note">
                This key is no longer active. Paste a fresh key below.
              </Typography>
            )}
            {claimError && (
              <Typography variant="caption" color="error" data-testid="supporter-claim-error">
                {claimError}
              </Typography>
            )}
          </Box>
        ) : null}

        {!isSupporter && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }} data-testid="supporter-purchase">
            <Box
              data-testid="supporter-purchase-grid"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              {(['themes', 'hosted'] as const).map((feature) => (
                <Box
                  key={feature}
                  data-testid={`supporter-plan-${feature}`}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {feature === 'themes' ? 'Discrub Supporter' : 'Discrub Bleeding Edge'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {feature === 'themes'
                        ? FEATURE_BLURB.themes
                        : `Everything in Supporter, plus the ${FEATURE_BLURB.hosted.charAt(0).toLowerCase()}${FEATURE_BLURB.hosted.slice(1)}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                    <Button
                      size="small"
                      variant="contained"
                      href={KOFI_MONTHLY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ ...kofiButtonSx, flex: 1 }}
                      data-testid={`supporter-kofi-${feature}-monthly`}
                    >
                      {feature === 'themes' ? '$3 / month' : '$5 / month'}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      href={feature === 'themes' ? KOFI_SUPPORTER_YEARLY_URL : KOFI_BLEEDING_EDGE_YEARLY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ flex: 1, textTransform: 'none', fontWeight: 700 }}
                      data-testid={`supporter-kofi-${feature}-yearly`}
                    >
                      {feature === 'themes' ? '$25 / year' : '$40 / year'}
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Yearly passes save about 30% and never renew on their own. One key covers
              everything you support, in the app and at {HOSTED_URL.replace('https://', '')}.
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
            {!payload && claimError && (
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
              right after you join. Once a key is in, Discrub checks in with our server
              about once a day to keep it current; removing the key stops that.
            </Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* ---- Themes ---- */}
        <Box data-testid="supporter-theme-showcase">
          <ThemeGrid
            value={themeSetting}
            onChange={handleThemePick}
            isSupporter={hasThemes}
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

        {/* ---- Export footer (live for supporters, shown disabled otherwise) ---- */}
        <Divider sx={{ my: 2 }} />
        <Box
          data-testid="supporter-footer-controls"
          data-locked={footerControlsDisabled ? 'true' : 'false'}
          sx={{ opacity: footerControlsDisabled ? 0.7 : 1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Export footer
            </Typography>
            {footerControlsDisabled && (
              <LockIcon sx={{ fontSize: 14, color: 'text.disabled' }} data-testid="supporter-footer-lock" />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            {footerControlsDisabled ? (
              <>
                HTML exports carry a small footer line. Supporters can reword it, give it
                their own icon, or turn it off.
              </>
            ) : (
              <>
                HTML exports carry a small footer line. As a supporter you can reword it,
                give it your own icon, or turn it off.
              </>
            )}
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={!footerRemoved}
                disabled={footerControlsDisabled}
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
              value={
                footerControlsDisabled
                  ? DEFAULT_FOOTER_TEXT
                  : (footerTextDraft ?? footer.text ?? '')
              }
              onChange={(e) => setFooterTextDraft(e.target.value)}
              onBlur={commitFooterText}
              onKeyDown={(e) => e.key === 'Enter' && commitFooterText()}
              disabled={footerControlsDisabled || footerRemoved}
              inputProps={
                {
                  'data-testid': 'supporter-footer-text',
                  maxLength: FOOTER_TEXT_MAX_LENGTH,
                } as object
              }
              helperText={footerControlsDisabled ? 'This is the line free exports carry' : 'Leave blank for the default line'}
              fullWidth
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {!footerControlsDisabled && footer.iconDataUri ? (
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
                disabled={footerControlsDisabled || footerRemoved}
                data-testid="supporter-footer-upload"
              >
                Custom icon
              </Button>
              {!footerControlsDisabled && footer.iconDataUri && (
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
      </DialogContent>
    </Dialog>
  );
};

export default SupporterDialog;
