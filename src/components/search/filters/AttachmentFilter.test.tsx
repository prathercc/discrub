import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttachmentFilter from './AttachmentFilter';

const setup = (over: Partial<React.ComponentProps<typeof AttachmentFilter>> = {}) => {
  const props = {
    extensions: [] as string[],
    filename: null,
    onExtensionsChange: vi.fn(),
    onFilenameChange: vi.fn(),
    mode: 'search' as const,
    onSubmit: vi.fn(),
    ...over,
  };
  render(<AttachmentFilter {...props} />);
  return props;
};

describe('AttachmentFilter (GH #13)', () => {
  it('adds normalized, de-duplicated extensions on Enter', () => {
    const p = setup({ extensions: ['png'] });
    const input = screen.getByTestId('attachment-extension-input-search');
    fireEvent.change(input, { target: { value: ' .PDF, png jpg ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(p.onExtensionsChange).toHaveBeenCalledWith(['png', 'pdf', 'jpg']);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('renders a chip per extension and removes on delete', () => {
    const p = setup({ extensions: ['png', 'pdf'] });
    expect(screen.getByText('png')).toBeInTheDocument();
    const chip = screen.getByText('pdf').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(chip.querySelector('.MuiChip-deleteIcon') as Element);
    expect(p.onExtensionsChange).toHaveBeenCalledWith(['png']);
  });

  it('forwards filename edits and submits on Enter', () => {
    const p = setup();
    const input = screen.getByTestId('attachment-filename-input-search');
    fireEvent.change(input, { target: { value: 'report.pdf' } });
    expect(p.onFilenameChange).toHaveBeenCalledWith('report.pdf');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(p.onSubmit).toHaveBeenCalled();
  });

  it('clears the filename to null when emptied', () => {
    const p = setup({ filename: 'report.pdf' });
    fireEvent.change(screen.getByTestId('attachment-filename-input-search'), { target: { value: '' } });
    expect(p.onFilenameChange).toHaveBeenLastCalledWith(null);
  });

  it('explains exact matching only in search mode', () => {
    setup({ mode: 'search' });
    expect(screen.getByText(/matches the full name exactly/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Exact file name/)).toBeInTheDocument();
  });

  it('uses substring wording in refine mode', () => {
    setup({ mode: 'refine' });
    expect(screen.queryByText(/matches the full name exactly/)).toBeNull();
    expect(screen.getByPlaceholderText('File name contains...')).toBeInTheDocument();
  });
});
