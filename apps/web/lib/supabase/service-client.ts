/**
 * Supabase Service Role Client
 * For server-side operations that need to bypass RLS
 * ONLY use in API routes with proper validation
 */

import { createClient } from '@supabase/supabase-js';

export const getSupabaseServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase service role configuration:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      env: process.env.NODE_ENV
    });
    throw new Error('Missing Supabase service role configuration. Please check your environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};