import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let supabaseClient: SupabaseClient | null = null;

export function initializeSupabaseClient(
  config: SupabaseConfig
): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false, // Electron app не нуждается в персистентной сессии
    },
    realtime: {
      params: {
        eventsPerSecond: 10, // Ограничиваем частоту для батчевых операций
      },
    },
  });

  return supabaseClient;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

export function destroySupabaseClient(): void {
  if (supabaseClient) {
    supabaseClient = null;
  }
}
