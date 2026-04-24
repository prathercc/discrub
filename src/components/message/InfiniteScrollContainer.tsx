import { useRef, useEffect, useCallback, forwardRef } from 'react';
import { TableContainer, TableContainerProps } from '@mui/material';

interface InfiniteScrollContainerProps extends TableContainerProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number; // Distance from bottom to trigger load (px)
}

/**
 * TableContainer with infinite scroll support.
 * Tracks whether the user was at the bottom when a load was triggered.
 * After load completes, auto-triggers another load if user was at bottom.
 */
const InfiniteScrollContainer = forwardRef<HTMLDivElement, InfiniteScrollContainerProps>(
  (
    {
      onLoadMore,
      hasMore,
      isLoading,
      threshold = 200,
      children,
      ...props
    },
    ref
  ) => {
    const loadingRef = useRef(false);
    const wasLoadingRef = useRef(false);

    const handleScroll = useCallback(() => {
      const container = typeof ref === 'function' ? null : ref?.current;
      if (!container || loadingRef.current || !hasMore || isLoading) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight === 0) return;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold) {
        loadingRef.current = true;
        onLoadMore();
        setTimeout(() => { loadingRef.current = false; }, 1000);
      }
    }, [hasMore, isLoading, onLoadMore, threshold, ref]);

    useEffect(() => {
      const container = typeof ref === 'function' ? null : ref?.current;
      if (!container) return;
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll, ref]);

    // After load completes: reset debounce and re-check scroll position.
    // Delayed check lets React render new content first, then sees if
    // user is still near the bottom of the updated content.
    useEffect(() => {
      if (wasLoadingRef.current && !isLoading && hasMore) {
        loadingRef.current = false;
        const timer = setTimeout(() => {
          const container = typeof ref === 'function' ? null : ref?.current;
          if (!container || loadingRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = container;
          if (scrollHeight > 0 && scrollHeight - scrollTop - clientHeight < threshold) {
            loadingRef.current = true;
            onLoadMore();
            setTimeout(() => { loadingRef.current = false; }, 1000);
          }
        }, 200);
        return () => clearTimeout(timer);
      }
      wasLoadingRef.current = isLoading;
    }, [isLoading, hasMore, onLoadMore, threshold, ref]);

    return (
      <TableContainer ref={ref} {...props}>
        {children}
      </TableContainer>
    );
  }
);

InfiniteScrollContainer.displayName = 'InfiniteScrollContainer';

export default InfiniteScrollContainer;
