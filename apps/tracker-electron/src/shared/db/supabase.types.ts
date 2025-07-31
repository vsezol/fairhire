import { ActivityEvent } from '../../features/activity-tracking/types';

export interface DatabaseSession {
  id: string;
  session_id: string;
  start_time: number;
  end_time?: number;
  call_url?: string;
  total_events: number;
  duration?: number;
  platform: string;
  app_version: string;
  // Новые поля для геометрии
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
}

export interface DatabaseUserActivity {
  id: string;
  session_id: string;
  event_type: ActivityEvent['type'];
  timestamp: number;
  event_data: ActivityEvent['data'];
  created_at: string;
}
