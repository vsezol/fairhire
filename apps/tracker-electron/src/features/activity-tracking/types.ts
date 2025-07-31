// Типы данных для каждого события
export interface MouseMoveData {
  x: number;
  y: number;
}

export interface MouseClickData {
  x: number;
  y: number;
  button: string;
}

export type AppFocusData = Record<string, never>;

export type AppBlurData = Record<string, never>;

export type AppShowData = Record<string, never>;

export type AppHideData = Record<string, never>;

export interface IdleStartData {
  idleDuration: number;
}

export interface IdleEndData {
  idleDuration: number;
}

export interface PageNavigateData {
  url: string;
  title?: string;
}

// Union type для всех событий активности
export type ActivityEvent =
  | { type: 'mouse_move'; timestamp: number; data: MouseMoveData }
  | { type: 'mouse_click'; timestamp: number; data: MouseClickData }
  | { type: 'app_focus'; timestamp: number; data: AppFocusData }
  | { type: 'app_blur'; timestamp: number; data: AppBlurData }
  | { type: 'app_show'; timestamp: number; data: AppShowData }
  | { type: 'app_hide'; timestamp: number; data: AppHideData }
  | { type: 'idle_start'; timestamp: number; data: IdleStartData }
  | { type: 'idle_end'; timestamp: number; data: IdleEndData }
  | { type: 'page_navigate'; timestamp: number; data: PageNavigateData };

export interface ActivitySession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  callUrl?: string;
  totalEvents: number;
}
