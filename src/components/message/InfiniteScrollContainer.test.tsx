import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createRef } from 'react';
import InfiniteScrollContainer from './InfiniteScrollContainer';

describe('InfiniteScrollContainer', () => {
  it('should render children', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={vi.fn()} hasMore={false} isLoading={false}>
        <div>Child content</div>
      </InfiniteScrollContainer>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should pass props to underlying TableContainer', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer
        ref={ref}
        onLoadMore={vi.fn()}
        hasMore={false}
        isLoading={false}
        data-testid="scroll-container"
      >
        <div>Content</div>
      </InfiniteScrollContainer>
    );
    expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
  });

  it('should not call onLoadMore when hasMore is false', () => {
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={false} isLoading={false}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );
    if (ref.current) {
      fireEvent.scroll(ref.current);
    }
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should not call onLoadMore when isLoading is true', () => {
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={true}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );
    if (ref.current) {
      fireEvent.scroll(ref.current);
    }
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should forward ref to the container element', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={vi.fn()} hasMore={false} isLoading={false}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('should use default threshold of 200', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={vi.fn()} hasMore={true} isLoading={false}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );
    // Component renders without error with default threshold
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should accept custom threshold', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={vi.fn()} hasMore={true} isLoading={false} threshold={500}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should re-check scroll position after loading completes', () => {
    vi.useFakeTimers();
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={true}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );

    // Mock scroll position near bottom
    if (ref.current) {
      Object.defineProperty(ref.current, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(ref.current, 'scrollTop', { value: 850, configurable: true });
      Object.defineProperty(ref.current, 'clientHeight', { value: 100, configurable: true });
    }

    // Loading completes — after delay, should re-check and trigger
    act(() => {
      rerender(
        <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={false}>
          <div>Content</div>
        </InfiniteScrollContainer>
      );
    });
    act(() => { vi.advanceTimersByTime(250); });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('should not auto-load on initial mount when isLoading starts as false', () => {
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();

    // Mount with isLoading=false, hasMore=true — simulates initial channel load completing
    render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={false}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );

    // Should NOT trigger onLoadMore — no true→false transition occurred
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should not auto-load when isLoading transitions false→false on rerender', () => {
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={false}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );

    // Rerender with same props (e.g. parent re-renders)
    act(() => {
      rerender(
        <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={false}>
          <div>Updated content</div>
        </InfiniteScrollContainer>
      );
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should not auto-load when loading completes and user is not near bottom', () => {
    vi.useFakeTimers();
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={true}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );

    // Mock scroll position far from bottom
    if (ref.current) {
      Object.defineProperty(ref.current, 'scrollHeight', { value: 5000, configurable: true });
      Object.defineProperty(ref.current, 'scrollTop', { value: 100, configurable: true });
      Object.defineProperty(ref.current, 'clientHeight', { value: 500, configurable: true });
    }

    // Loading completes — should NOT trigger because user is far from bottom
    act(() => {
      rerender(
        <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={false}>
          <div>Content</div>
        </InfiniteScrollContainer>
      );
    });
    act(() => { vi.advanceTimersByTime(250); });

    expect(onLoadMore).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not re-trigger load when hasMore is false after loading completes', () => {
    const onLoadMore = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={true} isLoading={true}>
        <div>Content</div>
      </InfiniteScrollContainer>
    );

    // Loading completes with no more items
    act(() => {
      rerender(
        <InfiniteScrollContainer ref={ref} onLoadMore={onLoadMore} hasMore={false} isLoading={false}>
          <div>Content</div>
        </InfiniteScrollContainer>
      );
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
