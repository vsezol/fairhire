import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

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
  isFocused: boolean;
}

export interface SessionGeometry {
  screen: ScreenGeometry;
  window: WindowGeometry;
  displayCount: number;
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
  window_is_focused?: boolean;
  created_at: string;
  updated_at: string;
  display_count: number;
  is_virtual?: boolean;
  virtual_host?: string;
  // Вычисляемое поле геометрии
  geometry?: SessionGeometry;
  processes?: ProcessInfo[];
  system_resources?: SystemResourceInfo;
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

export interface KeyDownEventData {
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface ProcessStartData {
  name: string;
  cmd: string;
  isSuspicious: boolean;
  isApplication: boolean;
}

export interface ProcessEndData {
  name: string;
  cmd: string;
  isSuspicious: boolean;
  isApplication: boolean;
}

export interface SystemResourceInfo {
  diskSpaceGB: number;
  ramGB: number;
  cpuCores: number;
}

// Union тип для всех возможных event_data
export type EventData =
  | MouseEventData
  | KeyEventData
  | WindowEventData
  | AppEventData
  | KeyDownEventData
  | ProcessStartData
  | ProcessEndData
  | Record<string, unknown>;

export interface UserActivity {
  id: string;
  session_id: string;
  event_type: string;
  timestamp: number;
  event_data: EventData;
  created_at: string;
}

export const isKeyDownActivity = (
  event: UserActivity
): event is UserActivity & { event_data: KeyDownEventData } => {
  return event.event_type === 'key_down';
};

export const isProcessStartActivity = (
  event: UserActivity
): event is UserActivity & { event_data: ProcessStartData } => {
  return event.event_type === 'process_start';
};

export const isProcessEndActivity = (
  event: UserActivity
): event is UserActivity & { event_data: ProcessEndData } => {
  return event.event_type === 'process_end';
};

// Типы для процессов
export interface ProcessInfo {
  name: string;
  isSuspicious: boolean;
  isApplication: boolean;
}

// Расширяем Session для включения процессов
export interface SessionWithProcesses extends Session {
  processes?: ProcessInfo[];
}
