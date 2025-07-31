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
