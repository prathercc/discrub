import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  CardGiftcard as GiftIcon,
  WorkspacePremium as BadgeIcon,
  Autorenew as RefreshIcon,
  DeleteOutline as RemoveIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectSupporterDialogOpen,
  selectSupporterKeyStatus,
  selectSupporterPayload,
  selectSupporterClaimInProgress,
  selectSupporterClaimError,
  selectSupporterHasStoredEmail,
  setSupporterDialogOpen,
  claimSupporterKey,
  refreshSupporterKey,
  applyPastedSupporterKey,
  removeSupporterKey,
} from '@features/supporter/supporterSlice';
import { THEME_DESCRIPTORS } from '@/theme/theme';
import { Swatch } from '@components/settings/tabs/ThemePicker';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

const KOFI_MONTHLY_URL = 'https://ko-fi.com/prathercc';
const KOFI_LIFETIME_URL = 'https://ko-fi.com/prathercc/shop';

/**
 * The Supporter dialog behind the toolbar gift button. Non-supporters
 * see the free-forever line, the supporter theme showcase, Ko-fi
 * links, and the email claim flow (with a paste-a-key fallback).
 * Supporters see their badge, name, and expiry, plus refresh/remove.
 *
 * Claiming stores the email for the always-on monthly auto-refresh —
 * disclosed in the claim copy; removing the key deletes the email and
 * stops all refresh calls.
 */
const SupporterDialog = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectSupporterDialogOpen);
  const keyStatus = useAppSelector(selectSupporterKeyStatus);
  const payload = useAppSelector(selectSupporterPayload);
  const claimInProgress = useAppSelector(selectSupporterClaimInProgress);
  const claimError = useAppSelector(selectSupporterClaimError);
  const hasStoredEmail = useAppSelector(selectSupporterHasStoredEmail);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedKey, setPastedKey] = useState('');

  const isSupporter = keyStatus === 'valid';
  const supporterThemes = THEME_DESCRIPTORS.filter((d) => d.tier === 'supporter');

  const handleClose = () => dispatch(setSupporterDialogOpen(false));

  const handleClaim = () => {
    if (!email.includes('@') || claimInProgress) return;
    dispatch(claimSupporterKey({ email: email.trim(), displayName }));
  };

  const handlePasteApply = () => {
    if (!pastedKey.trim() || claimInProgress) return;
    dispatch(applyPastedSupporterKey(pastedKey));
  };

  const handleRefresh = () => {
    if (claimInProgress) return;
    dispatch(refreshSupporterKey());
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
          <GiftIcon sx={{ fontSize: 40, color: 'cta.main', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isSupporter ? 'Thank you for supporting Discrub' : 'Support Discrub'}
          </Typography>
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

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              All supporter themes are unlocked. Pick one under Settings, Display.
              {payload.tier === 'monthly' &&
                ' Your key refreshes automatically while your membership is active.'}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {payload.tier === 'monthly' && (
                <Tooltip
                  title={
                    hasStoredEmail
                      ? 'Fetch a fresh key with your saved email'
                      : 'Enter your Ko-fi email below to refresh'
                  }
                  arrow
                >
                  <span>
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={handleRefresh}
                      disabled={claimInProgress || !hasStoredEmail}
                      data-testid="supporter-refresh-key"
                    >
                      Refresh key
                    </Button>
                  </span>
                </Tooltip>
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
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Discrub is free, and every feature always will be. Supporting unlocks a
              growing pack of cosmetic themes as a thank you.
            </Typography>

            {keyStatus === 'expired' && (
              <Typography
                variant="caption"
                sx={{ color: 'warning.main', textAlign: 'center' }}
                data-testid="supporter-lapsed-note"
              >
                Your membership lapsed, so supporter themes have relocked. Claim a fresh
                key below to pick up where you left off.
              </Typography>
            )}

            <Box
              data-testid="supporter-theme-showcase"
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}
            >
              {supporterThemes.map((d) => (
                <Tooltip key={d.id} title={d.name} arrow>
                  <Box sx={{ width: 64 }}>
                    <Swatch descriptor={d} />
                  </Box>
                </Tooltip>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button
                variant="contained"
                href={KOFI_MONTHLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ bgcolor: 'cta.main', '&:hover': { bgcolor: 'cta.dark' } }}
              >
                $3/month
              </Button>
              <Button
                variant="outlined"
                href={KOFI_LIFETIME_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                $25 lifetime
              </Button>
            </Box>

            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Already a supporter?
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Enter the email you used on Ko-fi and your themes unlock instantly. Your
                key refreshes automatically while your membership is active. Removing
                the key stops that and deletes the email from this device.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  size="small"
                  type="email"
                  label="Ko-fi email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
                  inputProps={{ 'data-testid': 'supporter-claim-email' } as object}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Display name (optional)"
                  helperText="Shown on your key, like a signed thank-you card"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
                  inputProps={{ 'data-testid': 'supporter-claim-name', maxLength: 40 } as object}
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleClaim}
                  disabled={!email.includes('@') || claimInProgress}
                  startIcon={claimInProgress ? <CircularProgress size={16} /> : <KeyIcon />}
                  data-testid="supporter-claim-submit"
                >
                  {claimInProgress ? 'Claiming...' : 'Claim my key'}
                </Button>
                {claimError && (
                  <Typography variant="caption" color="error" data-testid="supporter-claim-error">
                    {claimError}
                  </Typography>
                )}
              </Box>

              <Button
                size="small"
                sx={{ mt: 1, color: 'text.secondary', textTransform: 'none' }}
                onClick={() => setPasteOpen((v) => !v)}
                data-testid="supporter-paste-toggle"
              >
                Have a key already? Paste it instead
              </Button>
              <Collapse in={pasteOpen}>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
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
                    variant="outlined"
                    onClick={handlePasteApply}
                    disabled={!pastedKey.trim() || claimInProgress}
                    data-testid="supporter-paste-apply"
                  >
                    Apply
                  </Button>
                </Box>
              </Collapse>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupporterDialog;
