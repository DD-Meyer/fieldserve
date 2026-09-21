import { useCallback, useRef, useState } from "react";

type Refetcher = () => Promise<unknown>;

export function useRefresh(refetchers: Refetcher[]) {
  const [refreshing, setRefreshing] = useState(false);
  // Held in a ref so callers can pass a fresh inline array without re-creating onRefresh.
  const latest = useRef(refetchers);
  latest.current = refetchers;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(latest.current.map((refetch) => refetch()));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
