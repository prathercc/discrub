import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/test-utils';
import ImportDialog, { friendlyImportError } from './ImportDialog';
import { buildFixturePackage } from '@/test/package-fixtures';

describe('friendlyImportError', () => {
  it('maps the worker-clone / out-of-memory family to actionable copy (#210)', () => {
    const raw = "Failed to execute 'postMessage' on 'Worker': Data cannot be cloned, out of memory.";
    expect(friendlyImportError(raw)).toMatch(/ran out of memory/i);
    expect(friendlyImportError('Array buffer allocation failed')).toMatch(/ran out of memory/i);
  });

  it('maps the NotReadableError family to actionable copy (#203)', () => {
    const raw = 'The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.';
    const out = friendlyImportError(raw);
    expect(out).toMatch(/Couldn’t read the ZIP file/i);
    expect(out).toMatch(/cloud-synced folder/i);
  });

  it('passes through an unrecognized message unchanged', () => {
    expect(friendlyImportError('Package is missing account/user.json')).toBe(
      'Package is missing account/user.json',
    );
  });
});

describe('<ImportDialog />', () => {
  it('renders upload prompt when open', () => {
    renderWithProviders(<ImportDialog open onClose={() => {}} />);
    expect(screen.getByText(/Drop ZIP here/i)).toBeInTheDocument();
  });

  it('parses a valid package and calls onImported', async () => {
    const onImported = vi.fn();
    const onClose = vi.fn();
    const { store } = renderWithProviders(
      <ImportDialog open onClose={onClose} onImported={onImported} />,
    );

    const blob = await buildFixturePackage();
    const file = new File([blob], 'package.zip', { type: 'application/zip' });

    const input = screen.getByTestId('package-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(store.getState().package.status).toBe('ready');
    });
    expect(onImported).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error alert on invalid package', async () => {
    renderWithProviders(<ImportDialog open onClose={() => {}} />);

    const blob = await buildFixturePackage({ omitUserJson: true });
    const file = new File([blob], 'bad.zip', { type: 'application/zip' });

    const input = screen.getByTestId('package-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/user\.json|missing|failed/i);
  });
});
