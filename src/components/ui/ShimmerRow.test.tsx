import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

// ShimmerRow renders a <TableRow> so it must live inside a table structure
import ShimmerRow from './ShimmerRow';

function renderInTable(ui: React.ReactElement) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>
  );
}

describe('ShimmerRow', () => {
  it('should render a table row', () => {
    const { container } = renderInTable(<ShimmerRow />);
    expect(container.querySelector('tr')).toBeInTheDocument();
  });

  it('should use default colspan of 4', () => {
    const { container } = renderInTable(<ShimmerRow />);
    const cell = container.querySelector('td');
    expect(cell).toHaveAttribute('colspan', '4');
  });

  it('should use custom column span', () => {
    const { container } = renderInTable(<ShimmerRow columns={6} />);
    const cell = container.querySelector('td');
    expect(cell).toHaveAttribute('colspan', '6');
  });

  it('should render the shimmer animation box', () => {
    const { container } = renderInTable(<ShimmerRow />);
    const shimmerBox = container.querySelector('.MuiBox-root');
    expect(shimmerBox).toBeInTheDocument();
  });
});
