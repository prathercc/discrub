import { useState, useEffect, useRef } from 'react';
import type { Donation } from 'discrub-core/types/discrub-types';
import { fetchDonationData } from 'discrub-core/github-service';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useDonations(enabled: boolean) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchData = (showLoading = false) => {
      if (showLoading) setIsLoading(true);
      fetchDonationData()
        .then((data) => {
          if (!cancelled && data) setDonations(data);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    };

    // Fetch on drawer open (only shows loading spinner if no data yet)
    fetchData(donations.length === 0);

    // Poll every 5 minutes (silent)
    intervalRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { donations, isLoading: enabled ? isLoading : false };
}
