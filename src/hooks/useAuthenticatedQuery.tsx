import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { useAuth } from './useAuth';

/**
 * A wrapper around useQuery that ensures authentication before executing queries.
 * 
 * SECURITY NOTE: This is a UX-only check for better user experience.
 * Real authorization is enforced by Row-Level Security (RLS) at the database level.
 * Direct API calls will be blocked by RLS policies regardless of this check.
 * 
 * @param queryKey - The query key for React Query caching
 * @param queryFn - The query function that receives the authenticated user
 * @param options - Additional React Query options
 */
export function useAuthenticatedQuery<T>(
  queryKey: string[],
  queryFn: (user: User) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, string[]>, 'queryKey' | 'queryFn'>
) {
  const { user } = useAuth();

  return useQuery({
    queryKey,
    queryFn: () => {
      // UX-only check: Real authorization is enforced by RLS at database level.
      if (!user) {
        throw new Error('Authentication required');
      }
      return queryFn(user);
    },
    enabled: !!user && (options?.enabled !== false),
    ...options,
  });
}

/**
 * A wrapper around useQuery for mutations that ensures authentication.
 * 
 * SECURITY NOTE: This is a UX-only check for better user experience.
 * Real authorization is enforced by Row-Level Security (RLS) at the database level.
 */
export function useAuthenticatedUser() {
  const { user, loading } = useAuth();
  
  const requireAuth = () => {
    // UX-only check: Real authorization is enforced by RLS at database level.
    if (!user) {
      throw new Error('Authentication required');
    }
    return user;
  };

  return { user, loading, requireAuth };
}
