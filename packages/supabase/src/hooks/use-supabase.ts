import { useMemo } from 'react';

import { getSupabaseBrowserClient } from '../clients/browser-client';
import { Database } from '../database.types';

// Singleton instance to prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof getSupabaseBrowserClient> | null = null;

/**
 * @name useSupabase
 * @description Use Supabase in a React component with singleton pattern to prevent multiple GoTrueClient instances
 */
export function useSupabase<Db = Database>() {
  return useMemo(() => {
    if (!supabaseInstance) {
      supabaseInstance = getSupabaseBrowserClient<Db>();
    }
    return supabaseInstance;
  }, []);
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
