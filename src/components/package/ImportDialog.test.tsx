import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/test-utils';
import ImportDialog from './ImportDialog';
import { buildFixturePackage } from '@/test/package-fixtures';

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
