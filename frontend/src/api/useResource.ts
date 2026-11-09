import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from './client';

export interface ResourceState<T> {
  data: T | undefined;
  error: ApiError | Error | undefined;
  loading: boolean;
  reload: () => void;
}

/** Hook mínimo de carga (research.md D-14): estado de carga, error y recarga. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]): ResourceState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | Error | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    loadRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}
