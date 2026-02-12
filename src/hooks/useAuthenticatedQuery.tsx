import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export function useAuthenticatedQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, string[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  });
}

export function useAuthenticatedUser() {
  return { user: null, loading: false, requireAuth: () => { throw new Error('Auth removed'); } };
}