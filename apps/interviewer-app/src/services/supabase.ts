import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjhwsunzneimcnkybbnv.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaHdzdW56bmVpbWNua3liYm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3ODc3MDQsImV4cCI6MjA2OTM2MzcwNH0.JnLvWb8_nM3_ufLQ_JoS5PIrrC99pgBl3K-75Lpl_QI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Типы геометрии
export interface ScreenGeometry {
  width: number;
  height: number;
  scaleFactor: number;
}

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  isMinimized: boolean;
}

export interface SessionGeometry {
  screen: ScreenGeometry;
  window: WindowGeometry;
}

export interface Session {
  id: string;
  session_id: string;
  start_time: number;
  end_time?: number;
  call_url?: string;
  total_events: number;
  duration?: number;
  platform: string;
  app_version: string;
  // Новые поля геометрии
  screen_width?: number;
  screen_height?: number;
  screen_scale_factor?: number;
  window_x?: number;
  window_y?: number;
  window_width?: number;
  window_height?: number;
  window_is_visible?: boolean;
  window_is_minimized?: boolean;
  created_at: string;
  updated_at: string;
  // Вычисляемое поле геометрии
  geometry?: SessionGeometry;
}

// Типы для различных событий
export interface MouseEventData {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
}

export interface KeyEventData {
  key: string;
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export interface WindowEventData {
  width?: number;
  height?: number;
  focused?: boolean;
  visible?: boolean;
}

export interface AppEventData {
  app_name?: string;
  window_title?: string;
  process_id?: number;
}

// Union тип для всех возможных event_data
export type EventData =
  | MouseEventData
  | KeyEventData
  | WindowEventData
  | AppEventData
  | Record<string, unknown>;

export interface UserActivity {
  id: string;
  session_id: string;
  event_type: string;
  timestamp: number;
  event_data: EventData;
  created_at: string;
}
