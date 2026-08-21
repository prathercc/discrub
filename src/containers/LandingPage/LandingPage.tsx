import { useState, useEffect, useRef, FormEvent } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
  Stack,
  alpha,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  authenticateWithToken,
  clearManualLogout,
  selectAuthError,
  selectAuthLoading,
  selectManuallyLoggedOut,
} from '@features/auth/authSlice';
import { isExtensionMode, requestDiscordToken } from '@/extension/messaging';
import ResetDiscrubButton from '@components/settings/ResetDiscrubButton';
import { isHostedGateEnabled } from '@services/hostedGate';
import {
  applyPastedSupporterKey,
  removeSupporterKey,
  selectHasHosted,
  selectSupporter,
  selectSupporterClaimError,
  selectSupporterClaimInProgress,
} from '@features/supporter/supporterSlice';
import { liveSupporterFeatures } from '@services/supporterKeyService';
import { KOFI_MONTHLY_URL, KOFI_BLEEDING_EDGE_YEARLY_URL } from '@services/kofiLinks';
import BleedingTitle from '@components/supporter/BleedingTitle';

/**
 * Landing page component - handles user authentication with Discord token
 *
 * Supports three authentication methods (in order of precedence):
 * 1. Environment variable (VITE_DISCORD_TOKEN) - for development
 * 2. Extension auto-auth - automatically retrieves token from discord.com
 * 3. Manual token entry - user enters token manually
 *
 * Hosted build (VITE_HOSTED_GATE=true): a supporter key field sits
 * above the token field. The key persists (same storage as the palette
 * hub, so themes unlock through the same path); the token never leaves
 * memory. Sign-in needs a key carrying the `hosted` feature; a
 * themes-only key is told so before any token is asked for.
 */
const LandingPage = () => {
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const isLoading = useAppSelector(selectAuthLoading);
  const manuallyLoggedOut = useAppSelector(selectManuallyLoggedOut);
  const hostedGate = isHostedGateEnabled();
  // The dev env token would walk straight past the key gate, so the
  // hosted build never reads it (production web builds blank it anyway).
  const envToken = hostedGate ? '' : import.meta.env.VITE_DISCORD_TOKEN;

  const supporter = useAppSelector(selectSupporter);
  const hasHosted = useAppSelector(selectHasHosted);
  const keyBusy = useAppSelector(selectSupporterClaimInProgress);
  const keyError = useAppSelector(selectSupporterClaimError);
  const [keyInput, setKeyInput] = useState('');
  const keyPresent = supporter.keyStatus !== 'none' && supporter.payload !== null;
  const gateSatisfied = !hostedGate || hasHosted;
  const hostedKeyMessage = (() => {
    if (!hostedGate || !supporter.initialized || !keyPresent) return null;
    if (hasHosted) return null;
    const live = liveSupporterFeatures(supporter.payload);
    if (supporter.keyStatus !== 'valid' || live.length === 0) {
      return 'Supporter key no longer active.';
    }
    return "Supporter key validated, but it doesn't include Bleeding Edge.";
  })();

  const [token, setToken] = useState(envToken || '');
  const [isExtension, setIsExtension] = useState(false);
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);
  const [autoAuthLoading, setAutoAuthLoading] = useState(false);
  const [autoAuthError, setAutoAuthError] = useState<string | null>(null);

  // Detect extension mode on mount
  useEffect(() => {
    const extensionMode = isExtensionMode();
    setIsExtension(extensionMode);
  }, []);

  // Auto-authenticate via env token (development) — ref prevents strict mode double-fire
  const envAuthAttempted = useRef(false);
  useEffect(() => {
    if (envToken && envToken.trim() && !manuallyLoggedOut && !envAuthAttempted.current) {
      envAuthAttempted.current = true;
      dispatch(authenticateWithToken(envToken.trim())).catch((error) => {
        console.error('Auto-authentication (env) failed:', error);
        envAuthAttempted.current = false;
      });
    }
  }, [dispatch, envToken, manuallyLoggedOut]);

  // Auto-authenticate via extension (production)
  useEffect(() => {
    if (isExtension && !autoAuthAttempted && !envToken && !manuallyLoggedOut) {
      attemptAutoAuth();
    }
  }, [isExtension, autoAuthAttempted, envToken, manuallyLoggedOut]);

  const attemptAutoAuth = async () => {
    setAutoAuthAttempted(true);
    setAutoAuthLoading(true);
    setAutoAuthError(null);

    try {
      console.log('[Discrub] Attempting automatic token retrieval from Discord...');
      const response = await requestDiscordToken();

      if (response.success && response.token) {
        console.log('[Discrub] Token retrieved successfully, authenticating...');
        await dispatch(authenticateWithToken(response.token)).unwrap();
        // On success, App.tsx will automatically switch to the main layout
      } else {
        console.warn('[Discrub] Auto-auth failed:', response.error || 'No token found');
        setAutoAuthError(response.error || 'Could not retrieve token from Discord. Please ensure you are logged into discord.com.');
      }
    } catch (error) {
      console.error('[Discrub] Auto-authentication failed:', error);
      setAutoAuthError('Failed to authenticate. Please try manual entry.');
    } finally {
      setAutoAuthLoading(false);
    }
  };

  const handleApplyKey = () => {
    if (!keyInput.trim() || keyBusy) return;
    dispatch(applyPastedSupporterKey(keyInput)).then(() => setKeyInput(''));
  };

  const handleManualSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !gateSatisfied) {
      return;
    }

    try {
      await dispatch(authenticateWithToken(token.trim())).unwrap();
      // On success, App.tsx will automatically switch to the main layout
    } catch (error) {
      // Error is handled in Redux state and displayed via authError
      console.error('Authentication failed:', error);
    }
  };

  const handleRetryAutoAuth = () => {
    dispatch(clearManualLogout());
    setAutoAuthAttempted(false);
    setAutoAuthError(null);
  };

  // Show loading state during auto-auth
  if (isExtension && autoAuthLoading && !envToken) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: (theme) => `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
          padding: 2,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 5,
            maxWidth: 500,
            width: '100%',
            backgroundColor: (theme) => theme.palette.backgroundGlass,
            border: 1,
            borderColor: 'divider',
            borderRadius: 4,
          }}
        >
          <Stack spacing={3} alignItems="center">
            <CircularProgress size={60} />
            <Typography variant="h5" color="text.primary" textAlign="center">
              Authenticating with Discord...
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Retrieving your authentication token from discord.com
            </Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              This may take a few seconds
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: (theme) => `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
        backgroundImage: (theme: Theme) => `
          radial-gradient(circle at 20% 50%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, ${alpha(theme.palette.primary.dark, 0.1)} 0%, transparent 50%)
        `,
        padding: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 5,
          maxWidth: 500,
          width: '100%',
          backgroundColor: (theme) => theme.palette.backgroundGlass,
          border: (theme: Theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          borderRadius: 4,
          boxShadow: (theme: Theme) => `0 0 20px ${alpha(theme.palette.primary.main, 0.1)}`,
          animation: 'fade-in-scale 600ms ease',
        }}
      >
        <form onSubmit={handleManualSignIn}>
          <Stack spacing={3} alignItems="center">
            {/* Discrub Icon */}
            <Box
              component="img"
              src="/discrub.png"
              alt="Discrub"
              sx={{
                width: 80,
                height: 80,
                filter: (theme: Theme) =>
                  hostedGate
                    ? 'drop-shadow(0 8px 18px rgba(220, 38, 38, 0.55))'
                    : `drop-shadow(0 8px 16px ${alpha(theme.palette.primary.main, 0.4)})`,
              }}
            />

            {hostedGate ? (
              <BleedingTitle caption={`Early access build v${__APP_VERSION__}`} />
            ) : (
              <>
                <Typography variant="h4" color="text.primary" textAlign="center">
                  Welcome to Discrub
                </Typography>

                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {isExtension
                    ? 'Enter your Discord token manually or try auto-authentication'
                    : 'Enter your Discord token to manage messages'}
                </Typography>
              </>
            )}

            {envToken && import.meta.env.DEV && (
              <Alert severity="info" sx={{ width: '100%' }}>
                Using token from environment (.env file)
              </Alert>
            )}

            {autoAuthError && (
              <Alert severity="warning" sx={{ width: '100%' }}>
                {autoAuthError}
              </Alert>
            )}

            {authError && (
              <Alert severity="error" sx={{ width: '100%' }}>
                {authError}
              </Alert>
            )}

            {hostedGate && (
              <Box sx={{ width: '100%' }} data-testid="hosted-gate">
                {keyPresent && supporter.payload ? (
                  <Alert
                    severity={hasHosted ? 'success' : 'warning'}
                    data-testid="hosted-gate-key-status"
                    action={
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => dispatch(removeSupporterKey())}
                        data-testid="hosted-gate-forget-key"
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        Forget my key
                      </Button>
                    }
                  >
                    {hostedKeyMessage ?? 'Supporter key validated.'}
                  </Alert>
                ) : (
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Key"
                        placeholder="DSCRB-..."
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyKey();
                          }
                        }}
                        error={Boolean(keyError)}
                        helperText={
                          keyError ?? (
                            <span data-testid="hosted-gate-help">
                              Paste the key from your Ko-fi email. Don't have one? Get one{' '}
                              <Link
                                href={KOFI_MONTHLY_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="hosted-gate-kofi-monthly"
                              >
                                monthly
                              </Link>{' '}
                              or{' '}
                              <Link
                                href={KOFI_BLEEDING_EDGE_YEARLY_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="hosted-gate-kofi-yearly"
                              >
                                yearly
                              </Link>
                              .
                            </span>
                          )
                        }
                        disabled={keyBusy}
                        inputProps={{ 'data-testid': 'hosted-gate-key' } as object}
                        autoFocus
                      />
                      <Button
                        variant="outlined"
                        onClick={handleApplyKey}
                        disabled={!keyInput.trim() || keyBusy}
                        sx={{ alignSelf: 'flex-start', height: 40, flexShrink: 0 }}
                        data-testid="hosted-gate-apply"
                      >
                        {keyBusy ? <CircularProgress size={20} /> : 'Apply'}
                      </Button>
                    </Box>
                  </Stack>
                )}
              </Box>
            )}

            <TextField
              fullWidth
              type="password"
              label="Discord Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              error={Boolean(authError)}
              helperText={
                authError
                  ? 'Invalid token - please check and try again'
                  : 'Your token is stored in memory only (session-only)'
              }
              disabled={isLoading || !gateSatisfied}
              autoFocus={!isExtension && !hostedGate}
              required
            />

            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={!token.trim() || isLoading || !gateSatisfied}
              size="large"
              data-testid="landing-sign-in"
            >
              {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>

            {isExtension && (
              <Button
                fullWidth
                variant="outlined"
                onClick={handleRetryAutoAuth}
                disabled={isLoading || autoAuthLoading}
                size="large"
              >
                Try Auto-Authentication Again
              </Button>
            )}

            <Stack spacing={0.75} alignItems="center">
              <Link
                href="https://github.com/pratherbytecraft/discrub#finding-your-discord-token"
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                color="primary"
              >
                How to find my Discord token?
              </Link>
              <ResetDiscrubButton variant="link" />
            </Stack>

            {isExtension && (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Extension mode: Make sure you're logged into discord.com for auto-authentication
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary" textAlign="center">
              Note: This is an unofficial tool. Use at your own risk.
            </Typography>
            {hostedGate && (
              <Typography
                variant="caption"
                color="text.secondary"
                textAlign="center"
                data-testid="hosted-gate-phone-note"
              >
                On a phone? Exports download fine, but open them on a computer: phone file viewers
                can't show the export's pages and media.
              </Typography>
            )}
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

export default LandingPage;
