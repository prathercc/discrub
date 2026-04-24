import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DateRangeFilter from './DateRangeFilter';
import MessageTypeFilter from './MessageTypeFilter';
import UserFilter from './UserFilter';
import PinnedFilter from './PinnedFilter';
import AuthorTypeFilter from './AuthorTypeFilter';
import { AuthorType, HasType, IsPinnedType } from 'discrub-core/discord-enum';

describe('DateRangeFilter', () => {
  it('should render date title', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
      />
    );
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('should show "+ Add date" button when no mode is selected', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode={null}
        onDateModeChange={vi.fn()}
      />
    );
    expect(screen.getByText('Add date')).toBeInTheDocument();
  });

  it('should show Before picker when before mode is selected', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="before"
        onDateModeChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Before')).toBeInTheDocument();
  });

  it('should render mode toggle buttons when onDateModeChange is provided', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="before"
        onDateModeChange={vi.fn()}
      />
    );
    const toggleGroup = screen.getByRole('group');
    expect(within(toggleGroup).getByText('Before')).toBeInTheDocument();
    expect(within(toggleGroup).getByText('After')).toBeInTheDocument();
    expect(within(toggleGroup).getByText('During')).toBeInTheDocument();
  });

  it('should render single During picker in during mode', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="during"
        onDateModeChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('During')).toBeInTheDocument();
  });

  it('should render only After picker in after mode', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="after"
        onDateModeChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('After')).toBeInTheDocument();
    expect(screen.queryByLabelText('Before')).not.toBeInTheDocument();
  });

  it('should render only Before picker in before mode', () => {
    render(
      <DateRangeFilter
        startDate={null}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="before"
        onDateModeChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Before')).toBeInTheDocument();
    expect(screen.queryByLabelText('After')).not.toBeInTheDocument();
  });

  it('should display provided date values when mode is set', () => {
    const startDate = new Date(2024, 0, 15);
    render(
      <DateRangeFilter
        startDate={startDate}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="after"
        onDateModeChange={vi.fn()}
      />
    );
    const afterInput = screen.getByLabelText('After') as HTMLInputElement;
    expect(afterInput.value).toContain('01/15/2024');
  });

  it('should render a time-capable picker (DateTimePicker) in after mode', () => {
    const startDate = new Date(2024, 0, 15, 14, 30);
    render(
      <DateRangeFilter
        startDate={startDate}
        endDate={null}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="after"
        onDateModeChange={vi.fn()}
      />
    );
    const afterInput = screen.getByLabelText('After') as HTMLInputElement;
    // Formatted value includes hour and minute (e.g. "01/15/2024 02:30 PM")
    expect(afterInput.value).toMatch(/02:30/);
  });

  it('should render a time-capable picker (DateTimePicker) in before mode', () => {
    const endDate = new Date(2024, 0, 15, 9, 45);
    render(
      <DateRangeFilter
        startDate={null}
        endDate={endDate}
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        dateMode="before"
        onDateModeChange={vi.fn()}
      />
    );
    const beforeInput = screen.getByLabelText('Before') as HTMLInputElement;
    expect(beforeInput.value).toMatch(/09:45/);
  });
});

describe('MessageTypeFilter', () => {
  it('should render title', () => {
    render(<MessageTypeFilter selectedTypes={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Has')).toBeInTheDocument();
  });

  it('should render dropdown with "Any content" placeholder', () => {
    render(<MessageTypeFilter selectedTypes={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Any content')).toBeInTheDocument();
  });

  it('should show selected types as chips above dropdown', () => {
    render(<MessageTypeFilter selectedTypes={[HasType.IMAGE, HasType.VIDEO]} onChange={vi.fn()} />);
    // Selected types should appear as removable chips
    expect(screen.getByText('image')).toBeInTheDocument();
    expect(screen.getByText('video')).toBeInTheDocument();
  });

  it('should include poll and forward in dropdown options', () => {
    const { container } = render(<MessageTypeFilter selectedTypes={[]} onChange={vi.fn()} />);
    // Open the dropdown
    const select = container.querySelector('[role="combobox"]');
    if (select) fireEvent.mouseDown(select);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('poll')).toBeInTheDocument();
    expect(within(listbox).getByText('forward')).toBeInTheDocument();
  });

  it('should call onChange when a type is toggled via dropdown', () => {
    const onChange = vi.fn();
    const { container } = render(<MessageTypeFilter selectedTypes={[]} onChange={onChange} />);
    const select = container.querySelector('[role="combobox"]');
    if (select) fireEvent.mouseDown(select);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('image'));
    expect(onChange).toHaveBeenCalledWith([HasType.IMAGE]);
  });

  it('should call onChange to remove a type when chip delete is clicked', () => {
    const onChange = vi.fn();
    render(<MessageTypeFilter selectedTypes={[HasType.IMAGE, HasType.FILE]} onChange={onChange} />);
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledWith([HasType.FILE]);
  });
});

describe('UserFilter', () => {
  it('should render default title', () => {
    render(<UserFilter userIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Filter by Users')).toBeInTheDocument();
  });

  it('should render custom label', () => {
    render(<UserFilter userIds={[]} onChange={vi.fn()} label="From" />);
    expect(screen.getByText('From')).toBeInTheDocument();
  });

  it('should render custom placeholder', () => {
    render(<UserFilter userIds={[]} onChange={vi.fn()} placeholder="Type a user ID" />);
    expect(screen.getByPlaceholderText('Type a user ID')).toBeInTheDocument();
  });

  it('should render input with default placeholder', () => {
    render(<UserFilter userIds={[]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Enter user ID and press Enter')).toBeInTheDocument();
  });

  it('should display user ID chips', () => {
    render(<UserFilter userIds={['12345', '67890']} onChange={vi.fn()} />);
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('67890')).toBeInTheDocument();
  });

  it('should add user ID on Enter key', () => {
    const onChange = vi.fn();
    render(<UserFilter userIds={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Enter user ID and press Enter');
    fireEvent.change(input, { target: { value: 'newuser123' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
    expect(onChange).toHaveBeenCalledWith(['newuser123']);
  });

  it('should remove user ID when chip delete is clicked', () => {
    const onChange = vi.fn();
    render(<UserFilter userIds={['12345', '67890']} onChange={onChange} />);
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledWith(['67890']);
  });

  it('should not add duplicate user IDs', () => {
    const onChange = vi.fn();
    render(<UserFilter userIds={['12345']} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Enter user ID and press Enter');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('PinnedFilter', () => {
  it('should render title', () => {
    render(<PinnedFilter value={IsPinnedType.UNSET} onChange={vi.fn()} />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('should render dropdown with options', () => {
    const { container } = render(<PinnedFilter value={IsPinnedType.UNSET} onChange={vi.fn()} />);
    const select = container.querySelector('[role="combobox"]');
    expect(select).toBeInTheDocument();
  });

  it('should show current value', () => {
    render(<PinnedFilter value={IsPinnedType.UNSET} onChange={vi.fn()} />);
    expect(screen.getByText('Any')).toBeInTheDocument();
  });

  it('should call onChange when value changes', () => {
    const onChange = vi.fn();
    const { container } = render(<PinnedFilter value={IsPinnedType.UNSET} onChange={onChange} />);
    const select = container.querySelector('[role="combobox"]');
    if (select) fireEvent.mouseDown(select);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('True'));
    expect(onChange).toHaveBeenCalledWith(IsPinnedType.YES);
  });
});

describe('AuthorTypeFilter', () => {
  it('should render title', () => {
    render(<AuthorTypeFilter value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Author Type')).toBeInTheDocument();
  });

  it('should render dropdown with Any selected by default', () => {
    render(<AuthorTypeFilter value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Any')).toBeInTheDocument();
  });

  it('should show current value', () => {
    render(<AuthorTypeFilter value={AuthorType.BOT} onChange={vi.fn()} />);
    expect(screen.getByText('bot')).toBeInTheDocument();
  });

  it('should call onChange with AuthorType when selected', () => {
    const onChange = vi.fn();
    const { container } = render(<AuthorTypeFilter value={null} onChange={onChange} />);
    const select = container.querySelector('[role="combobox"]');
    if (select) fireEvent.mouseDown(select);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('bot'));
    expect(onChange).toHaveBeenCalledWith(AuthorType.BOT);
  });

  it('should call onChange with null when Any is selected', () => {
    const onChange = vi.fn();
    const { container } = render(<AuthorTypeFilter value={AuthorType.BOT} onChange={onChange} />);
    const select = container.querySelector('[role="combobox"]');
    if (select) fireEvent.mouseDown(select);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Any'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
