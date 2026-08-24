import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ContentFilter, { withDraft } from './ContentFilter';

/** Harness that owns the draft the way FilterModal does. */
const Harness = ({ terms, mode, onChange, onSubmit }: { terms: string[]; mode: 'search' | 'refine'; onChange: (t: string[]) => void; onSubmit: (t: string[]) => void }) => {
  const [draft, setDraft] = useState('');
  return <ContentFilter terms={terms} onChange={onChange} draft={draft} onDraftChange={setDraft} onSubmit={onSubmit} mode={mode} />;
};

describe('ContentFilter (#244)', () => {
  const setup = (terms: string[] = [], mode: 'search' | 'refine' = 'search') => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness terms={terms} onChange={onChange} onSubmit={onSubmit} mode={mode} />);
    const input = screen.getByTestId(`content-filter-${mode}-input`) as HTMLInputElement;
    return { onChange, onSubmit, input };
  };

  it('withDraft trims, dedupes, and returns the same array when nothing is added', () => {
    const terms = ['a'];
    expect(withDraft(terms, '  b ')).toEqual(['a', 'b']);
    expect(withDraft(terms, 'a')).toBe(terms);
    expect(withDraft(terms, '   ')).toBe(terms);
  });

  it('Enter adds the typed term and applies, keeping the one-term habit', () => {
    const { onChange, onSubmit, input } = setup();
    fireEvent.change(input, { target: { value: '  hello ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['hello']);
    expect(onSubmit).toHaveBeenCalledWith(['hello']);
    expect(input.value).toBe('');
  });

  it('comma adds a term without applying', () => {
    const { onChange, onSubmit, input } = setup(['one']);
    fireEvent.change(input, { target: { value: 'two' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(onChange).toHaveBeenCalledWith(['one', 'two']);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter on an empty box just applies', () => {
    const { onChange, onSubmit, input } = setup(['one']);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('blur commits the draft and duplicates are ignored', () => {
    const { onChange, input } = setup(['one']);
    fireEvent.change(input, { target: { value: 'one' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'two' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(['one', 'two']);
  });

  it('renders a deletable chip per term and explains any-of for several terms', () => {
    const { onChange } = setup(['alpha', 'beta']);
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText(/Any of 2 terms/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('CancelIcon')[0]);
    expect(onChange).toHaveBeenCalledWith(['beta']);
  });

  it('keeps a constant placeholder per section', () => {
    setup([], 'refine');
    expect(screen.getByPlaceholderText('Filter by content...')).toBeInTheDocument();
  });
});
