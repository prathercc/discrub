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
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  authenticateWithToken,
  clearManualLogout,
  selectAuthError,
  selectAuthLoading,
  selectManuallyLoggedOut,
} from '@features/auth/authSlice';
import { isExtensionMode, requestDiscordToken } from '@/extension/messaging';

/**
 * Landing page component - handles user authentication with Discord token
 *
 * Supports three authentication methods (in order of precedence):
 * 1. Environment variable (VITE_DISCORD_TOKEN) - for development
 * 2. Extension auto-auth - automatically retrieves token from discord.com
 * 3. Manual token entry - user enters token manually
 */
const LandingPage = () => {
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const isLoading = useAppSelector(selectAuthLoading);
  const manuallyLoggedOut = useAppSelector(selectManuallyLoggedOut);
  const envToken = import.meta.env.VITE_DISCORD_TOKEN;

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

  const handleManualSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
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
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(114, 137, 218, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(88, 101, 242, 0.1) 0%, transparent 50%)
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
          border: '1px solid rgba(114, 137, 218, 0.2)',
          borderRadius: 4,
          boxShadow: '0 0 20px rgba(114, 137, 218, 0.1)',
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
                filter: 'drop-shadow(0 8px 16px rgba(114, 137, 218, 0.4))',
              }}
            />

            <Typography variant="h4" color="text.primary" textAlign="center">
              Welcome to Discrub
            </Typography>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              {isExtension
                ? 'Enter your Discord token manually or try auto-authentication'
                : 'Enter your Discord token to manage messages'}
            </Typography>

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
              disabled={isLoading}
              autoFocus={!isExtension}
              required
            />

            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={!token.trim() || isLoading}
              size="large"
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

            <Box>
              <Link
                href="https://github.com/prathercc/discrub#finding-your-discord-token"
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                color="primary"
              >
                How to find my Discord token?
              </Link>
            </Box>

            {isExtension && (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Extension mode: Make sure you're logged into discord.com for auto-authentication
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary" textAlign="center">
              Note: This is an unofficial tool. Use at your own risk.
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

export default LandingPage;
