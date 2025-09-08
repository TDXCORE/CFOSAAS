import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '@kit/supabase/database';

/**
 * Class representing an API for interacting with user accounts.
 * @constructor
 * @param {SupabaseClient<Database>} client - The Supabase client instance.
 */
class AccountsApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * @name getAccount
   * @description Get the account data for the given ID.
   * @param id
   */
  async getAccount(id: string) {
    try {
      const { data, error } = await this.client
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        // If accounts table doesn't exist, return fallback data
        if (error.code === 'PGRST116' || error.message?.includes('404')) {
          console.warn('Accounts table not found, using fallback data');
          return {
            id,
            name: 'Demo User',
            picture_url: null,
            email: null,
            created_at: new Date().toISOString(),
            created_by: null,
            updated_at: new Date().toISOString(),
            updated_by: null,
            public_data: {},
          };
        }
        throw error;
      }

      return data;
    } catch (error: any) {
      // Handle 404 errors gracefully with fallback data
      if (error.status === 404 || error.message?.includes('404')) {
        console.warn('Accounts table not found, using fallback data:', error);
        return {
          id,
          name: 'Demo User',
          picture_url: null,
          email: null,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          public_data: {},
        };
      }
      throw error;
    }
  }
}

export function createAccountsApi(client: SupabaseClient<Database>) {
  return new AccountsApi(client);
}
