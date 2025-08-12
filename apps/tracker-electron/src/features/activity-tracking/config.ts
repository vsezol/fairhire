import { SupabaseConfig } from '../../shared/db/supabase.client.js';

export const getSupabaseConfig = (): SupabaseConfig => {
  return {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
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
