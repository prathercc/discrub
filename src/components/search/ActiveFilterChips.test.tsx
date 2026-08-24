import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActiveFilterChips from './ActiveFilterChips';
import { AuthorType, HasType, IsPinnedType } from 'discrub-core/discord-enum';
import { defaultCriteria } from './searchConstants';

const defaultProps = {
  searchCriteria: defaultCriteria,
  refineCriteria: defaultCriteria,
  onClearSearchFilter: vi.fn(),
  onClearRefineFilter: vi.fn(),
  onClearAll: vi.fn(),
};

describe('ActiveFilterChips', () => {
  it('should render nothing when no filters active', () => {
    const { container } = render(<ActiveFilterChips {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render search chips as blurple filled', () => {
    render(<ActiveFilterChips {...defaultProps} searchCriteria={{ ...defaultCriteria, userIds: ['123'] }} />);
    const chip = screen.getByText('from: 123').closest('.MuiChip-root');
    expect(chip?.classList.toString()).toContain('MuiChip-filled');
    expect(chip?.classList.toString()).toContain('MuiChip-colorPrimary');
  });

  it('should render refine chips as gray outlined', () => {
    render(<ActiveFilterChips {...defaultProps} refineCriteria={{ ...defaultCriteria, searchMessageContent: 'local' }} />);
    const chip = screen.getByText('content: local').closest('.MuiChip-root');
    expect(chip?.classList.toString()).toContain('MuiChip-outlined');
  });

  it('should render both search and refine chips simultaneously', () => {
    render(
      <ActiveFilterChips
        {...defaultProps}
        searchCriteria={{ ...defaultCriteria, searchMessageContent: 'server' }}
        refineCriteria={{ ...defaultCriteria, searchMessageContent: 'local' }}
      />
    );
    expect(screen.getByText('content: server')).toBeInTheDocument();
    expect(screen.getByText('content: local')).toBeInTheDocument();
  });

  it('should call onClearSearchFilter when search chip is deleted', () => {
    const onClearSearchFilter = vi.fn();
    render(
      <ActiveFilterChips
        {...defaultProps}
        onClearSearchFilter={onClearSearchFilter}
        searchCriteria={{ ...defaultCriteria, userIds: ['123'] }}
      />
    );
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    fireEvent.click(deleteButtons[0]);
    expect(onClearSearchFilter).toHaveBeenCalledWith('userIds', '123');
  });

  it('should call onClearRefineFilter when refine chip is deleted', () => {
    const onClearRefineFilter = vi.fn();
    render(
      <ActiveFilterChips
        {...defaultProps}
        onClearRefineFilter={onClearRefineFilter}
        refineCriteria={{ ...defaultCriteria, searchMessageContent: 'test' }}
      />
    );
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    fireEvent.click(deleteButtons[0]);
    expect(onClearRefineFilter).toHaveBeenCalledWith('searchMessageContent', undefined);
  });

  it('should call onClearAll when clear all is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <ActiveFilterChips
        {...defaultProps}
        onClearAll={onClearAll}
        searchCriteria={{ ...defaultCriteria, userIds: ['123'] }}
      />
    );
    fireEvent.click(screen.getByLabelText('Clear all filters'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('should render search icon on search chips', () => {
    render(<ActiveFilterChips {...defaultProps} searchCriteria={{ ...defaultCriteria, searchMessageContent: 'test' }} />);
    expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
  });

  it('should render refine icon on refine chips', () => {
    render(<ActiveFilterChips {...defaultProps} refineCriteria={{ ...defaultCriteria, searchMessageContent: 'test' }} />);
    expect(screen.getByTestId('FilterListIcon')).toBeInTheDocument();
  });

  it('should render all filter types from both layers', () => {
    render(
      <ActiveFilterChips
        {...defaultProps}
        searchCriteria={{
          ...defaultCriteria,
          searchMessageContent: 'server',
          userIds: ['111'],
          selectedHasTypes: [HasType.IMAGE],
          searchAfterDate: new Date(2026, 0, 1),
          isPinned: IsPinnedType.YES,
          authorType: AuthorType.BOT,
          mentionIds: ['222'],
        }}
        refineCriteria={{
          ...defaultCriteria,
          searchMessageContent: 'local',
          userIds: ['333'],
        }}
      />
    );
    // Search chips
    expect(screen.getByText('content: server')).toBeInTheDocument();
    expect(screen.getByText('from: 111')).toBeInTheDocument();
    expect(screen.getByText('has: image')).toBeInTheDocument();
    expect(screen.getByText(/after:/)).toBeInTheDocument();
    expect(screen.getByText('pinned: true')).toBeInTheDocument();
    expect(screen.getByText('author: bot')).toBeInTheDocument();
    expect(screen.getByText('mentions: 222')).toBeInTheDocument();
    // Refine chips
    expect(screen.getByText('content: local')).toBeInTheDocument();
    expect(screen.getByText('from: 333')).toBeInTheDocument();
  });

  it('should not render chips for channelIds', () => {
    render(<ActiveFilterChips {...defaultProps} searchCriteria={{ ...defaultCriteria, channelIds: ['123'] }} />);
    expect(screen.queryByText(/channel/)).not.toBeInTheDocument();
  });

  it('omits time from date chip when date is midnight', () => {
    render(
      <ActiveFilterChips
        {...defaultProps}
        searchCriteria={{ ...defaultCriteria, searchAfterDate: new Date(2026, 0, 1, 0, 0, 0) }}
      />
    );
    expect(screen.getByText(/after: Jan 1, 2026$/)).toBeInTheDocument();
  });

  it('appends time to date chip when time-of-day is non-midnight', () => {
    render(
      <ActiveFilterChips
        {...defaultProps}
        searchCriteria={{ ...defaultCriteria, searchAfterDate: new Date(2026, 0, 1, 14, 30, 0) }}
      />
    );
    expect(screen.getByText(/after: Jan 1, 2026 · 2:30 PM/)).toBeInTheDocument();
  });

  it('renders attachment chips and clears them by field/value (GH #13)', () => {
    const onClearSearchFilter = vi.fn();
    render(
      <ActiveFilterChips
        {...defaultProps}
        onClearSearchFilter={onClearSearchFilter}
        searchCriteria={{ ...defaultCriteria, attachmentExtensions: ['png', 'pdf'], attachmentFilename: 'report.pdf' }}
      />,
    );
    expect(screen.getByText('file type: png')).toBeInTheDocument();
    expect(screen.getByText('file type: pdf')).toBeInTheDocument();
    const nameChip = screen.getByText('file name: report.pdf').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(nameChip.querySelector('.MuiChip-deleteIcon') as Element);
    expect(onClearSearchFilter).toHaveBeenCalledWith('attachmentFilename', undefined);
    const extChip = screen.getByText('file type: pdf').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(extChip.querySelector('.MuiChip-deleteIcon') as Element);
    expect(onClearSearchFilter).toHaveBeenCalledWith('attachmentExtensions', 'pdf');
  });
});
