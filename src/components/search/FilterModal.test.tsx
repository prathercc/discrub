import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import FilterModal from './FilterModal';
import { IsPinnedType } from 'discrub-core/discord-enum';
import { defaultCriteria } from './searchConstants';
import { renderWithProviders } from '@/test/test-utils';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onServerSearch: vi.fn(),
  onRefine: vi.fn(),
  onClearSearch: vi.fn(),
  onClearRefine: vi.fn(),
  cachedUserMap: {},
  currentUserId: '123',
};

describe('FilterModal', () => {
  describe('rendering', () => {
    it('should render when open', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should not render content when closed', () => {
      renderWithProviders(<FilterModal {...defaultProps} open={false} />);
      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    it('should render Search section header', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      expect(screen.getByText('Discord API')).toBeInTheDocument();
    });

    it('should render Refine section header', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      expect(screen.getByText('Refine')).toBeInTheDocument();
      expect(screen.getByText('Loaded messages')).toBeInTheDocument();
    });

    it('should render all filter fields', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      // Two "From" labels (search + refine)
      expect(screen.getAllByText('From').length).toBeGreaterThanOrEqual(2);
      // "Has" appears twice (search + refine)
      expect(screen.getAllByText('Has').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Mentions')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Author Type')).toBeInTheDocument();
    });
  });

  describe('search section', () => {
    it('should call onServerSearch when Search button is clicked', () => {
      const onServerSearch = vi.fn();
      const savedSearchCriteria = { ...defaultCriteria, searchMessageContent: 'test' };
      renderWithProviders(<FilterModal {...defaultProps} onServerSearch={onServerSearch} savedSearchCriteria={savedSearchCriteria} />);
      fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
      expect(onServerSearch).toHaveBeenCalled();
    });

    it('should disable Search button when no search filters active', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      const searchButtons = screen.getAllByRole('button', { name: /^Search$/ });
      // The contained "Search" button in the search section
      const searchBtn = searchButtons.find(btn => btn.classList.contains('MuiButton-contained'));
      expect(searchBtn).toBeDisabled();
    });

    it('should call onClearSearch when search Clear is clicked', () => {
      const onClearSearch = vi.fn();
      const savedSearchCriteria = { ...defaultCriteria, userIds: ['123'] };
      renderWithProviders(<FilterModal {...defaultProps} onClearSearch={onClearSearch} savedSearchCriteria={savedSearchCriteria} />);
      // Find the search section's Clear button (first one)
      const clearButtons = screen.getAllByRole('button', { name: /Clear/ });
      fireEvent.click(clearButtons[0]);
      expect(onClearSearch).toHaveBeenCalled();
    });

    it('should trigger search on Enter in content field', () => {
      const onServerSearch = vi.fn();
      renderWithProviders(<FilterModal {...defaultProps} onServerSearch={onServerSearch} />);
      const input = screen.getByPlaceholderText('Search message content...');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onServerSearch).toHaveBeenCalled();
    });

    it('should show search filter count', () => {
      const savedSearchCriteria = { ...defaultCriteria, userIds: ['1', '2'], isPinned: IsPinnedType.YES };
      renderWithProviders(<FilterModal {...defaultProps} savedSearchCriteria={savedSearchCriteria} />);
      expect(screen.getByText(/Clear \(3\)/)).toBeInTheDocument();
    });
  });

  describe('refine section', () => {
    it('should call onRefine when Apply Refine is clicked', () => {
      const onRefine = vi.fn();
      const savedRefineCriteria = { ...defaultCriteria, searchMessageContent: 'local' };
      renderWithProviders(<FilterModal {...defaultProps} onRefine={onRefine} savedRefineCriteria={savedRefineCriteria} />);
      fireEvent.click(screen.getByRole('button', { name: /Apply Refine/ }));
      expect(onRefine).toHaveBeenCalled();
    });

    it('should disable Apply Refine when no refine filters active', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      const refineBtn = screen.getByRole('button', { name: /Apply Refine/ });
      expect(refineBtn).toBeDisabled();
    });

    it('should call onClearRefine when refine Clear is clicked', () => {
      const onClearRefine = vi.fn();
      const savedRefineCriteria = { ...defaultCriteria, searchMessageContent: 'test' };
      renderWithProviders(<FilterModal {...defaultProps} onClearRefine={onClearRefine} savedRefineCriteria={savedRefineCriteria} />);
      // Refine clear is the second Clear button
      const clearButtons = screen.getAllByRole('button', { name: /Clear/ });
      fireEvent.click(clearButtons[1]);
      expect(onClearRefine).toHaveBeenCalled();
    });

    it('should trigger refine on Enter in refine content field', () => {
      const onRefine = vi.fn();
      renderWithProviders(<FilterModal {...defaultProps} onRefine={onRefine} />);
      const input = screen.getByPlaceholderText('Filter by content...');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRefine).toHaveBeenCalled();
    });
  });

  describe('independent state', () => {
    it('should maintain separate criteria for search and refine', () => {
      const savedSearchCriteria = { ...defaultCriteria, searchMessageContent: 'server query' };
      const savedRefineCriteria = { ...defaultCriteria, searchMessageContent: 'local filter' };
      renderWithProviders(<FilterModal {...defaultProps} savedSearchCriteria={savedSearchCriteria} savedRefineCriteria={savedRefineCriteria} />);
      expect(screen.getByDisplayValue('server query')).toBeInTheDocument();
      expect(screen.getByDisplayValue('local filter')).toBeInTheDocument();
    });

    it('should not persist changes to parent until apply is clicked', () => {
      const onServerSearch = vi.fn();
      renderWithProviders(<FilterModal {...defaultProps} onServerSearch={onServerSearch} />);
      // Type content but don't click Search
      const input = screen.getByPlaceholderText('Search message content...');
      fireEvent.change(input, { target: { value: 'typed but not applied' } });
      // onServerSearch should NOT have been called
      expect(onServerSearch).not.toHaveBeenCalled();
    });
  });

  describe('close and keyboard', () => {
    it('should call onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<FilterModal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when X is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<FilterModal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByLabelText('Close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('should close on Escape', () => {
      const onClose = vi.fn();
      renderWithProviders(<FilterModal {...defaultProps} onClose={onClose} />);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('date progressive disclosure', () => {
    it('should show "+ Add date" by default', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      expect(screen.getByText('Add date')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should render correctly with null savedCriteria', () => {
      renderWithProviders(<FilterModal {...defaultProps} savedSearchCriteria={undefined} savedRefineCriteria={undefined} />);
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should convert empty content string to null on apply', () => {
      const onServerSearch = vi.fn();
      const saved = { ...defaultCriteria, searchMessageContent: 'old' };
      renderWithProviders(<FilterModal {...defaultProps} onServerSearch={onServerSearch} savedSearchCriteria={saved} />);
      const input = screen.getByPlaceholderText('Search message content...');
      // Clear the content
      fireEvent.change(input, { target: { value: '' } });
      // Apply — should call onClearSearch since filters are empty but there are changes
      // The button is enabled because searchHasChanges is true
      fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
      // onServerSearch should NOT be called (count is 0, so it calls onClearSearch)
      expect(onServerSearch).not.toHaveBeenCalled();
    });
  });

  describe('hideAuthorFilters (Backlog #137)', () => {
    it('renders the Search-section From and Author Type fields by default', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      expect(screen.getByTestId('filter-modal-search-from')).toBeInTheDocument();
      expect(screen.getByTestId('filter-modal-search-author-type')).toBeInTheDocument();
    });

    it('renders both fields when hideAuthorFilters is explicitly false', () => {
      renderWithProviders(<FilterModal {...defaultProps} hideAuthorFilters={false} />);
      expect(screen.getByTestId('filter-modal-search-from')).toBeInTheDocument();
      expect(screen.getByTestId('filter-modal-search-author-type')).toBeInTheDocument();
    });

    it('hides the Search-section From field when hideAuthorFilters is true', () => {
      renderWithProviders(<FilterModal {...defaultProps} hideAuthorFilters />);
      expect(screen.queryByTestId('filter-modal-search-from')).toBeNull();
    });

    it('hides the Search-section Author Type field when hideAuthorFilters is true', () => {
      renderWithProviders(<FilterModal {...defaultProps} hideAuthorFilters />);
      expect(screen.queryByTestId('filter-modal-search-author-type')).toBeNull();
    });

    it('keeps every other Search-section field visible when hideAuthorFilters is true', () => {
      renderWithProviders(<FilterModal {...defaultProps} hideAuthorFilters />);
      expect(screen.getByPlaceholderText(/Search message content/i)).toBeInTheDocument();
      expect(screen.getAllByText('Has').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Mentions')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getAllByText(/Pinned/i).length).toBeGreaterThanOrEqual(1);
    });

    it('still renders the Refine-section From (which has its own scope)', () => {
      // Refine's "From" filters already-loaded messages — independent of
      // the Search-section author lock. hideAuthorFilters only affects
      // the Search section. With Search-From hidden, the total From
      // count drops from 2 (search + refine) to 1 (refine only).
      renderWithProviders(<FilterModal {...defaultProps} hideAuthorFilters />);
      expect(screen.getAllByText('From')).toHaveLength(1);
    });
  });
});
