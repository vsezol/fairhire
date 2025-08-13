import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../env.js';
import { SupabaseConfig } from '../../shared/db/supabase.client.js';

export const getSupabaseConfig = (): SupabaseConfig => {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
};

export const validateSupabaseConfig = (config: SupabaseConfig): boolean => {
  if (!config.url || !config.anonKey) {
    console.error(
      '❌ Supabase configuration incomplete: missing URL or anon key'
    );
    return false;
  }

  if (!config.url.startsWith('http')) {
    console.error('❌ Invalid Supabase URL format');
    return false;
  }

  return true;
};
