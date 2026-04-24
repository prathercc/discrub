import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { store } from '@/app/store';
import { addStatusEntry } from '@features/status/statusSlice';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render crashes in the component tree.
 * Logs the error to the status log and shows a recovery UI.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack?.split('\n')[1]?.trim() || '';
    store.dispatch(
      addStatusEntry({
        level: 'error',
        message: `Render crash: ${error.message}${componentStack ? ` (${componentStack})` : ''}`,
      })
    );
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 2,
            p: 4,
            textAlign: 'center',
            bgcolor: 'background.default',
            color: 'text.primary',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 400 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Typography>
          <Button variant="contained" onClick={this.handleRecover}>
            Try Again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
