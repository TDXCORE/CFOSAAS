/**
 * Supabase Client Singleton
 * Ensures only one Supabase client instance is created to avoid multiple GoTrueClient warnings
 */

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the singleton Supabase client instance
 * This prevents multiple GoTrueClient instances that cause auth issues
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = getSupabaseBrowserClient();
  }
  return supabaseInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}