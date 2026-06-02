/**
 * Minimal in-house replacement for the slice of `@tanstack/react-query`
 * this app uses: useQuery (with `enabled` + `refetchInterval` polling),
 * useMutation, and a QueryClient whose `invalidateQueries` does prefix
 * matching on the query key (e.g. invalidating ["live", id] refetches
 * ["live", id, "state"], ["live", id, "wp"], …).
 *
 * No external dependency. Intentionally tiny — only what the app needs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type QueryKey = readonly unknown[];

function hashKey(key: QueryKey): string {
  return JSON.stringify(key);
}

/** True when `filter` is a prefix of `full` (react-query partial matching). */
function keyStartsWith(filter: QueryKey, full: QueryKey): boolean {
  if (filter.length > full.length) return false;
  return filter.every((part, i) => hashKey([part]) === hashKey([full[i]]));
}

interface Subscriber {
  key: QueryKey;
  refetch: () => void;
}

export class QueryClient {
  private subscribers = new Set<Subscriber>();
  private cache = new Map<string, unknown>();

  // Accepts (and ignores) a react-query-style config object for drop-in use.
  constructor(_config?: unknown) {}

  subscribe(sub: Subscriber): () => void {
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  invalidateQueries(filter: { queryKey: QueryKey }): void {
    for (const sub of this.subscribers) {
      if (keyStartsWith(filter.queryKey, sub.key)) sub.refetch();
    }
  }

  getQueryData<T = unknown>(key: QueryKey): T | undefined {
    return this.cache.get(hashKey(key)) as T | undefined;
  }

  setQueryData<T = unknown>(key: QueryKey, data: T): void {
    this.cache.set(hashKey(key), data);
    for (const sub of this.subscribers) {
      if (hashKey(sub.key) === hashKey(key)) sub.refetch();
    }
  }

  /** Drops all cached query data (used on logout). */
  clear(): void {
    this.cache.clear();
  }

  /** @internal — used by useQuery to store results. */
  _writeCache(key: QueryKey, data: unknown): void {
    this.cache.set(hashKey(key), data);
  }
  /** @internal */
  _readCache<T = unknown>(key: QueryKey): T | undefined {
    return this.cache.get(hashKey(key)) as T | undefined;
  }
}

// ─── Provider / context ──────────────────────────────────────────────
const QueryContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryContext.Provider value={client}>{children}</QueryContext.Provider>;
}

export function useQueryClient(): QueryClient {
  const client = useContext(QueryContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a <QueryClientProvider>");
  }
  return client;
}

// ─── useQuery ────────────────────────────────────────────────────────
export interface UseQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  refetchInterval?: number | false;
  /**
   * Kept for drop-in compatibility. This implementation already retains the
   * previous data across key changes until the next fetch resolves, so the
   * callback is accepted but never needs to be invoked.
   */
  placeholderData?: (previousData: T | undefined) => T | undefined;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
}

export function useQuery<T = unknown, _TError = Error>({
  queryKey,
  queryFn,
  enabled = true,
  refetchInterval = false,
}: UseQueryOptions<T>): UseQueryResult<T> {
  const client = useQueryClient();
  const keyHash = hashKey(queryKey);

  const [data, setData] = useState<T | undefined>(
    () => client._readCache<T>(queryKey),
  );
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(
    () => client._readCache<T>(queryKey) === undefined,
  );

  // Keep latest queryFn / key without retriggering the fetch identity.
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  const fetchData = useCallback(async () => {
    setIsFetching(true);
    try {
      const result = await queryFnRef.current();
      setData(result);
      client._writeCache(queryKeyRef.current, result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, keyHash]);

  // Initial fetch + refetch when the key changes or the query becomes enabled.
  useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [enabled, fetchData]);

  // Register for invalidation while enabled.
  useEffect(() => {
    if (!enabled) return;
    return client.subscribe({ key: queryKeyRef.current, refetch: fetchData });
  }, [client, enabled, fetchData]);

  // Polling.
  useEffect(() => {
    if (!enabled || !refetchInterval) return;
    const id = setInterval(fetchData, refetchInterval);
    return () => clearInterval(id);
  }, [enabled, refetchInterval, fetchData]);

  return {
    data,
    error,
    isLoading: enabled ? isLoading : false,
    isFetching,
    isError: error !== null,
    isSuccess: error === null && data !== undefined,
    refetch: fetchData,
  };
}

// ─── useMutation ─────────────────────────────────────────────────────
export interface UseMutationOptions<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>;
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: Error, vars: TVars) => void;
}

/** Per-call callbacks passed to `mutate(vars, options)`. */
export interface MutateCallbacks<TData, TVars> {
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: Error, vars: TVars) => void;
}

export interface UseMutationResult<TData, TVars> {
  mutate: (vars: TVars, options?: MutateCallbacks<TData, TVars>) => void;
  mutateAsync: (
    vars: TVars,
    options?: MutateCallbacks<TData, TVars>,
  ) => Promise<TData>;
  isPending: boolean;
  data: TData | undefined;
  error: Error | null;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}

export function useMutation<TData = unknown, TVars = void>({
  mutationFn,
  onSuccess,
  onError,
}: UseMutationOptions<TData, TVars>): UseMutationResult<TData, TVars> {
  const [isPending, setIsPending] = useState(false);
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // Refs keep mutate/mutateAsync identity stable (matches react-query).
  const fnRef = useRef(mutationFn);
  fnRef.current = mutationFn;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const mutateAsync = useCallback(
    async (
      vars: TVars,
      options?: MutateCallbacks<TData, TVars>,
    ): Promise<TData> => {
      setIsPending(true);
      setError(null);
      try {
        const result = await fnRef.current(vars);
        setData(result);
        onSuccessRef.current?.(result, vars);
        options?.onSuccess?.(result, vars);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onErrorRef.current?.(e, vars);
        options?.onError?.(e, vars);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  const mutate = useCallback(
    (vars: TVars, options?: MutateCallbacks<TData, TVars>) => {
      mutateAsync(vars, options).catch(() => {
        /* surfaced via the `error` state */
      });
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending,
    data,
    error,
    isError: error !== null,
    isSuccess: error === null && data !== undefined,
    reset,
  };
}
