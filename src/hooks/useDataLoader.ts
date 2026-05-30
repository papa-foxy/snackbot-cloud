import { useState, useEffect, useRef } from 'react';

// Global cache to persist data across component unmounts (navigation)
const globalCache: Record<string, any> = {};

/**
 * A custom hook to load data based on the current page/component.
 * It caches the data so that when the user navigates back, the data remains loaded
 * and doesn't need to be fetched again unless explicitly requested.
 * 
 * @param pageId Unique identifier for the page/component (e.g., 'dashboard', 'inventory')
 * @param fetcher Async function that fetches the data
 * @param dependencies Optional array of dependencies that should trigger a refetch
 */
export function useDataLoader<T>(
  pageId: string,
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(globalCache[pageId] || null);
  const [loading, setLoading] = useState<boolean>(!globalCache[pageId]);
  const [error, setError] = useState<Error | null>(null);
  
  const isFirstRender = useRef(true);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await fetcher();
        if (isMounted) {
          globalCache[pageId] = result;
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Fetch if data is not in cache, OR if dependencies changed (and it's not the first render)
    const hasDepsChanged = !isFirstRender.current && dependencies.length > 0;
    
    if (!globalCache[pageId] || hasDepsChanged) {
      loadData();
    } else {
      // Data is already in cache, just use it
      setData(globalCache[pageId]);
      setLoading(false);
    }

    isFirstRender.current = false;

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const refetch = async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      globalCache[pageId] = result;
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const updateCache = (newData: T) => {
    globalCache[pageId] = newData;
    setData(newData);
  };

  return { data, loading, error, refetch, updateCache };
}
