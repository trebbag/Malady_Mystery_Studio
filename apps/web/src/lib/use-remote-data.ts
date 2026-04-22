import { useEffect, useState } from 'react';

interface RemoteDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useRemoteData<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown>) {
  const [state, setState] = useState<RemoteDataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let disposed = false;

    setState((current) => ({
      data: current.data,
      loading: true,
      error: null,
    }));

    loader()
      .then((data) => {
        if (disposed) {
          return;
        }

        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (disposed) {
          return;
        }

        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    return () => {
      disposed = true;
    };
  }, deps);

  return state;
}
