import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncData<T>(loader: () => Promise<T>, _dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  // Keep refresh pointed at the latest closure without retriggering initial loading.
  // eslint-disable-next-line react-hooks/refs
  loaderRef.current = loader;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The operation failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loaderRef.current()
      .then((value) => { if (active) setData(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'The operation failed.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { data, setData, loading, error, refresh };
}
