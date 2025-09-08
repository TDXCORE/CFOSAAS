import { useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export function usePersonalAccountData(
  userId: string,
  partialAccount?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  },
) {
  const client = useSupabase();
  const queryKey = ['account:data', userId];

  const queryFn = async () => {
    if (!userId) {
      return null;
    }

    try {
      const response = await client
        .from('accounts')
        .select(
          `
          id,
          name,
          picture_url
      `,
        )
        .eq('id', userId)
        .single();

      if (response.error) {
        // If accounts table doesn't exist, return fallback data
        if (response.error.code === 'PGRST116' || response.error.message?.includes('404')) {
          console.warn('Accounts table not found, using fallback data');
          return {
            id: userId,
            name: 'Demo User',
            picture_url: null,
          };
        }
        throw response.error;
      }

      return response.data;
    } catch (error: any) {
      // Handle 404 errors gracefully with fallback data  
      if (error.status === 404 || error.message?.includes('404')) {
        console.warn('Accounts table not found, using fallback data:', error);
        return {
          id: userId,
          name: 'Demo User', 
          picture_url: null,
        };
      }
      throw error;
    }
  };

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!userId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    initialData: partialAccount?.id
      ? {
          id: partialAccount.id,
          name: partialAccount.name,
          picture_url: partialAccount.picture_url,
        }
      : undefined,
  });
}

export function useRevalidatePersonalAccountDataQuery() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string) =>
      queryClient.invalidateQueries({
        queryKey: ['account:data', userId],
      }),
    [queryClient],
  );
}
