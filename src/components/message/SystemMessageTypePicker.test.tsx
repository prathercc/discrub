import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import SystemMessageTypePicker from './SystemMessageTypePicker';
import { ALL_SYSTEM_GROUP_KEYS } from '@/utils/systemMessageGroups';

const render = (ui: React.ReactElement) => renderWithProviders(ui);

describe('<SystemMessageTypePicker />', () => {
  it('renders a checkbox for every group', () => {
    render(<SystemMessageTypePicker selectedGroups={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Pin notifications' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Member joins & leaves' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Other events' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(ALL_SYSTEM_GROUP_KEYS.length);
  });

  it('reflects selectedGroups as checked state', () => {
    render(<SystemMessageTypePicker selectedGroups={['pins']} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Pin notifications' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Boost notifications' })).not.toBeChecked();
  });

  it('calls onChange with the toggled group when a checkbox is clicked', () => {
    const onChange = vi.fn();
    render(<SystemMessageTypePicker selectedGroups={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pin notifications' }));
    expect(onChange).toHaveBeenCalledWith(['pins']);
  });

  it('removes a group when its checked box is clicked', () => {
    const onChange = vi.fn();
    render(<SystemMessageTypePicker selectedGroups={['pins', 'boosts']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pin notifications' }));
    expect(onChange).toHaveBeenCalledWith(['boosts']);
  });

  it('Select all sends every group key; the label flips to Clear all when full', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SystemMessageTypePicker selectedGroups={[]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenCalledWith(ALL_SYSTEM_GROUP_KEYS);

    rerender(<SystemMessageTypePicker selectedGroups={ALL_SYSTEM_GROUP_KEYS} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  });

  it('Clear all empties the selection', () => {
    const onChange = vi.fn();
    render(<SystemMessageTypePicker selectedGroups={ALL_SYSTEM_GROUP_KEYS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders the optional description text', () => {
    render(
      <SystemMessageTypePicker
        selectedGroups={[]}
        onChange={vi.fn()}
        description="Pick the system messages to act on."
      />,
    );
    expect(screen.getByText('Pick the system messages to act on.')).toBeInTheDocument();
  });
});
