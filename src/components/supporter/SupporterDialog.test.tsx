import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, renderWithProviders } from '@/test/test-utils';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import SupporterDialog from './SupporterDialog';
import { createBaseState } from '@/test/state-factories';
import { initialSupporterState } from '@features/supporter/supporterTypes';
import type { SupporterKeyPayload } from '@services/supporterKeyService';

const { stateStore, mediaStore, settingsStore } = vi.hoisted(() => {
  const makeAdapter = () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    getMany: vi.fn(async () => []),
    setMany: vi.fn(async () => {}),
  });
  return { stateStore: makeAdapter(), mediaStore: makeAdapter(), settingsStore: makeAdapter() };
});
vi.mock('@/extension/storage', () => ({
  storage: { state: stateStore, media: mediaStore, settings: settingsStore },
}));

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('@services/supporterKeyService', () => ({ verifySupporterKey: mockVerify }));

const { mockRequestRefresh, MockClaimError } = vi.hoisted(() => {
  class MockClaimError extends Error {
    status: number | null;
    constructor(message: string, status: number | null) {
      super(message);
      this.name = 'SupporterClaimError';
      this.status = status;
    }
  }
  return { mockRequestRefresh: vi.fn(), MockClaimError };
});
vi.mock('@services/supporterClaimService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@services/supporterClaimService')>();
  return {
    // Pure input classifier — keep the real code/key routing.
    normalizeSupporterCode: actual.normalizeSupporterCode,
    requestSupporterKeyRefresh: mockRequestRefresh,
    requestSupporterKeyRedemption: vi.fn(),
    SupporterClaimError: MockClaimError,
  };
});

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
    it('shows the pitch, the full theme grid with locks, and the Ko-fi button', () => {
      renderDialog();

      expect(screen.getByText(/growing pack of cosmetic themes/i)).toBeInTheDocument();

      // The hub carries the full grid: free themes clickable, supporter
      // themes locked.
      const showcase = screen.getByTestId('supporter-theme-showcase');
      expect(showcase).toBeInTheDocument();
      expect(screen.getByTestId('theme-card-auto')).toBeInTheDocument();
      expect(screen.getByTestId('theme-card-terminal')).toBeInTheDocument();
      expect(screen.getByTestId('theme-locked-amoled-void')).toBeInTheDocument();

      // Two purchase paths, each pinned to its permanent Ko-fi URL.
      expect(screen.getByTestId('supporter-kofi-monthly')).toHaveAttribute(
        'href',
        'https://ko-fi.com/prathercc/tiers',
      );
      expect(screen.getByTestId('supporter-kofi-lifetime')).toHaveAttribute(
        'href',
        'https://ko-fi.com/s/0b4f9b2bdf',
      );
    });

    it('applies a free theme instantly from the grid', () => {
      const { store } = renderDialog();
      fireEvent.click(screen.getByTestId('theme-card-terminal'));
      expect(store.getState().app.previewThemeId).toBe('terminal');
    });

    it('clicking a locked theme card previews it without selecting', () => {
      const { store } = renderDialog();
      fireEvent.click(screen.getByTestId('theme-card-amoled-void'));
      // The dialog stays open, the theme previews, nothing is selected.
      expect(store.getState().supporter.dialogOpen).toBe(true);
      expect(store.getState().app.previewThemeId).toBe('amoled-void');
      expect(screen.queryByTestId('theme-selected-amoled-void')).toBeNull();
    });

    it('discloses key delivery, renewal, and the footer perk', () => {
      renderDialog();
      // The sender address is a mailto link for support questions.
      expect(screen.getByTestId('supporter-key-email-link')).toHaveAttribute(
        'href',
        'mailto:keys@pratherbytecraft.com',
      );
      expect(screen.getByText(/right after you join/i)).toBeInTheDocument();
      expect(screen.getByText(/Monthly keys renew automatically/i)).toBeInTheDocument();
      expect(
        screen.getByText(/reword, rebrand, or remove the footer on HTML exports/i),
      ).toBeInTheDocument();
    });

    it('toggles theme animations instantly from the hub', async () => {
      const { store } = renderDialog();
      const toggle = screen.getByTestId('theme-animations-toggle');
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);
      await waitFor(() => {
        expect(
          store.getState().app.settings?.[DiscrubSetting.APP_THEME_ANIMATIONS],
        ).toBe('false');
      });
    });

    it('disables Apply until a key is pasted, then unlocks', async () => {
      mockVerify.mockResolvedValue({ status: 'valid', payload });

      renderDialog();
      const apply = screen.getByTestId('supporter-paste-apply');
      expect(apply).toBeDisabled();

      fireEvent.change(screen.getByTestId('supporter-paste-key'), {
        target: { value: 'DSCRB-pasted' },
      });
      expect(apply).not.toBeDisabled();
      fireEvent.click(apply);

      await waitFor(() => {
        expect(screen.getByTestId('supporter-status')).toBeInTheDocument();
      });
      expect(screen.getByText(/issued to Aaron P\./i)).toBeInTheDocument();
    });

    it('shows matching copy for an invalid pasted key', async () => {
      mockVerify.mockResolvedValue({ status: 'invalid' });

      renderDialog();
      fireEvent.change(screen.getByTestId('supporter-paste-key'), {
        target: { value: 'DSCRB-bad' },
      });
      fireEvent.click(screen.getByTestId('supporter-paste-apply'));

      await waitFor(() => {
        expect(screen.getByTestId('supporter-claim-error')).toHaveTextContent(
          /doesn't look like a valid supporter key/,
        );
      });
    });

    it('shows the lapsed note when the stored key expired', () => {
      renderDialog({ keyStatus: 'expired', payload });
      expect(screen.getByTestId('supporter-lapsed-note')).toBeInTheDocument();
    });
  });

  describe('supporter state', () => {
    it('shows the badge, name, expiry, and an unlocked grid', () => {
      renderDialog({ keyStatus: 'valid', payload });

      expect(screen.getByText(/issued to Aaron P\./i)).toBeInTheDocument();
      expect(screen.getByText(/key valid through/i)).toBeInTheDocument();
      expect(screen.getByTestId('supporter-refresh-key')).not.toBeDisabled();
      expect(screen.queryByTestId('theme-locked-amoled-void')).toBeNull();
      expect(screen.getByTestId('theme-card-amoled-void')).toBeInTheDocument();
    });

    it('refreshes by presenting the stored key', async () => {
      stateStore.get.mockResolvedValue('DSCRB-current' as never);
      mockRequestRefresh.mockResolvedValue({
        key: 'DSCRB-fresh',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: 'whenever',
      });
      mockVerify.mockResolvedValue({ status: 'valid', payload: { ...payload, jti: 'jti-2' } });

      renderDialog({ keyStatus: 'valid', payload });
      fireEvent.click(screen.getByTestId('supporter-refresh-key'));

      await waitFor(() => {
        expect(mockRequestRefresh).toHaveBeenCalledWith('DSCRB-current');
      });
    });

    it('shows lifetime status with no refresh button', () => {
      renderDialog({
        keyStatus: 'valid',
        payload: { ...payload, tier: 'lifetime', exp: null },
      });

      expect(screen.getByText('Lifetime supporter')).toBeInTheDocument();
      expect(screen.queryByTestId('supporter-refresh-key')).not.toBeInTheDocument();
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
      renderDialog({ keyStatus: 'valid', payload });

      fireEvent.click(screen.getByTestId('supporter-remove-key'));

      await waitFor(() => {
        expect(screen.queryByTestId('supporter-status')).not.toBeInTheDocument();
      });
      expect(stateStore.remove).toHaveBeenCalledTimes(2);
    });
  });
});
