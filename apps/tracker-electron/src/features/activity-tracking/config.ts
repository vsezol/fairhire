import { SupabaseConfig } from '../../shared/db/supabase.client.js';

export const getSupabaseConfig = (): SupabaseConfig => {
  return {
    url: 'https://jjhwsunzneimcnkybbnv.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaHdzdW56bmVpbWNua3liYm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3ODc3MDQsImV4cCI6MjA2OTM2MzcwNH0.JnLvWb8_nM3_ufLQ_JoS5PIrrC99pgBl3K-75Lpl_QI',
  };
};

// Функция для валидации конфигурации
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
