import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, renderWithProviders } from '@/test/test-utils';
import SupporterDialog from './SupporterDialog';
import { createBaseState } from '@/test/state-factories';
import { initialSupporterState } from '@features/supporter/supporterTypes';
import { THEME_DESCRIPTORS } from '@/theme/theme';
import type { SupporterKeyPayload } from '@services/supporterKeyService';

const { stateStore, mediaStore } = vi.hoisted(() => {
  const makeAdapter = () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  });
  return { stateStore: makeAdapter(), mediaStore: makeAdapter() };
});
vi.mock('@/extension/storage', () => ({ storage: { state: stateStore, media: mediaStore } }));

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('@services/supporterKeyService', () => ({ verifySupporterKey: mockVerify }));

const { mockRequestKey, MockClaimError } = vi.hoisted(() => {
  class MockClaimError extends Error {
    status: number | null;
    constructor(message: string, status: number | null) {
      super(message);
      this.name = 'SupporterClaimError';
      this.status = status;
    }
  }
  return { mockRequestKey: vi.fn(), MockClaimError };
});
vi.mock('@services/supporterClaimService', () => ({
  requestSupporterKey: mockRequestKey,
  SupporterClaimError: MockClaimError,
}));

const DAY_S = 24 * 60 * 60;

const payload: SupporterKeyPayload = {
  v: 1,
  kid: '2026-2',
  jti: 'jti-1',
  name: 'Aaron P.',
  eh: 'hash',
  tier: 'monthly',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 30 * DAY_S,
};

const renderDialog = (supporterOverrides = {}) =>
  renderWithProviders(<SupporterDialog />, {
    preloadedState: createBaseState({
      supporter: { ...initialSupporterState, initialized: true, dialogOpen: true, ...supporterOverrides },
    }) as never,
  });

describe('SupporterDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('non-supporter state', () => {
    it('shows the free-forever pitch, theme showcase, and Ko-fi links', () => {
      renderDialog();

      expect(screen.getByText(/free, and every feature always will be/i)).toBeInTheDocument();

      const supporterCount = THEME_DESCRIPTORS.filter((d) => d.tier === 'supporter').length;
      const showcase = screen.getByTestId('supporter-theme-showcase');
      expect(showcase.children).toHaveLength(supporterCount);

      expect(screen.getByRole('link', { name: '$3/month' })).toHaveAttribute(
        'href',
        'https://ko-fi.com/prathercc',
      );
      expect(screen.getByRole('link', { name: '$25 lifetime' })).toHaveAttribute(
        'href',
        'https://ko-fi.com/prathercc/shop',
      );
    });

    it('discloses auto-refresh at the consent moment', () => {
      renderDialog();
      expect(
        screen.getByText(/key refreshes automatically while your membership is active/i),
      ).toBeInTheDocument();
    });

    it('disables Claim until the email looks like an email', () => {
      renderDialog();
      const submit = screen.getByTestId('supporter-claim-submit');
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByTestId('supporter-claim-email'), {
        target: { value: 'not-an-email' },
      });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByTestId('supporter-claim-email'), {
        target: { value: 'user@example.com' },
      });
      expect(submit).not.toBeDisabled();
    });

    it('claims, unlocks, and flips to the supporter state', async () => {
      mockRequestKey.mockResolvedValue({
        key: 'DSCRB-claimed',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: 'whenever',
      });
      mockVerify.mockResolvedValue({ status: 'valid', payload });

      renderDialog();
      fireEvent.change(screen.getByTestId('supporter-claim-email'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByTestId('supporter-claim-name'), {
        target: { value: 'Aaron P.' },
      });
      fireEvent.click(screen.getByTestId('supporter-claim-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('supporter-status')).toBeInTheDocument();
      });
      expect(mockRequestKey).toHaveBeenCalledWith('user@example.com', 'Aaron P.');
      expect(screen.getByText(/issued to Aaron P\./i)).toBeInTheDocument();
    });

    it('shows the server error message on a failed claim', async () => {
      mockRequestKey.mockRejectedValue(
        new MockClaimError('No active supporter membership was found for that email', 404),
      );

      renderDialog();
      fireEvent.change(screen.getByTestId('supporter-claim-email'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.click(screen.getByTestId('supporter-claim-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('supporter-claim-error')).toHaveTextContent(
          'No active supporter membership was found for that email',
        );
      });
    });

    it('applies a pasted key through the fallback flow', async () => {
      mockVerify.mockResolvedValue({ status: 'valid', payload });

      renderDialog();
      fireEvent.click(screen.getByTestId('supporter-paste-toggle'));
      fireEvent.change(screen.getByTestId('supporter-paste-key'), {
        target: { value: 'DSCRB-pasted' },
      });
      fireEvent.click(screen.getByTestId('supporter-paste-apply'));

      await waitFor(() => {
        expect(screen.getByTestId('supporter-status')).toBeInTheDocument();
      });
    });

    it('shows the lapsed note when the stored key expired', () => {
      renderDialog({ keyStatus: 'expired', payload });
      expect(screen.getByTestId('supporter-lapsed-note')).toBeInTheDocument();
    });
  });

  describe('supporter state', () => {
    it('shows the badge, name, and expiry for a monthly supporter', () => {
      renderDialog({ keyStatus: 'valid', payload, hasStoredEmail: true });

      expect(screen.getByText(/issued to Aaron P\./i)).toBeInTheDocument();
      expect(screen.getByText(/key valid through/i)).toBeInTheDocument();
      expect(screen.getByTestId('supporter-refresh-key')).not.toBeDisabled();
    });

    it('shows lifetime status with no refresh button', () => {
      renderDialog({
        keyStatus: 'valid',
        payload: { ...payload, tier: 'lifetime', exp: null },
      });

      expect(screen.getByText('Lifetime supporter')).toBeInTheDocument();
      expect(screen.queryByTestId('supporter-refresh-key')).not.toBeInTheDocument();
    });

    it('disables refresh when no email is stored (pasted key)', () => {
      renderDialog({ keyStatus: 'valid', payload, hasStoredEmail: false });
      expect(screen.getByTestId('supporter-refresh-key')).toBeDisabled();
    });

    it('shows footer controls with working text, toggle, and icon-clear actions', async () => {
      const { store } = renderDialog({
        keyStatus: 'valid',
        payload,
        footer: { text: null, removed: false, iconDataUri: 'data:image/png;base64,abc' },
      });

      expect(screen.getByTestId('supporter-footer-controls')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('supporter-footer-text'), {
        target: { value: 'My archive' },
      });
      fireEvent.blur(screen.getByTestId('supporter-footer-text'));
      await waitFor(() => {
        expect(store.getState().supporter.footer.text).toBe('My archive');
      });

      fireEvent.click(screen.getByTestId('supporter-footer-enabled'));
      await waitFor(() => {
        expect(store.getState().supporter.footer.removed).toBe(true);
      });

      expect(screen.getByTestId('supporter-footer-icon-preview')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('supporter-footer-icon-remove'));
      await waitFor(() => {
        expect(store.getState().supporter.footer.iconDataUri).toBeNull();
      });
    });

    it('shows an error for a rejected icon upload (SVG)', async () => {
      renderDialog({ keyStatus: 'valid', payload });

      const input = screen.getByTestId('supporter-footer-icon-input');
      const svg = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });
      fireEvent.change(input, { target: { files: [svg] } });

      await waitFor(() => {
        expect(screen.getByTestId('supporter-footer-icon-error')).toHaveTextContent(
          /PNG, JPEG, or WebP/,
        );
      });
    });

    it('hides footer controls from non-supporters', () => {
      renderDialog();
      expect(screen.queryByTestId('supporter-footer-controls')).not.toBeInTheDocument();
    });

    it('remove key clears supporter state back to the pitch', async () => {
      renderDialog({ keyStatus: 'valid', payload, hasStoredEmail: true });

      fireEvent.click(screen.getByTestId('supporter-remove-key'));

      await waitFor(() => {
        expect(screen.queryByTestId('supporter-status')).not.toBeInTheDocument();
      });
      expect(stateStore.remove).toHaveBeenCalledTimes(2);
    });
  });
});
