import { z } from 'zod';

/**
 * Returns and validates the Supabase client keys from the environment.
 */
export function getSupabaseClientKeys() {
  const keys = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  
  // Debug logging removed - issue resolved
  
  return z
    .object({
      url: z.string().min(1),
      anonKey: z.string().min(1),
    })
    .parse(keys);
}
