import { SystemResourceInfo } from '../vm-detection/vm-detection.service';

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

export type AppOpenData = Record<string, never>;

export type AppCloseData = Record<string, never>;

export type ScreenshotAttemptData = Record<string, never>;

export interface KeyDownEventData {
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface PageNavigateData {
  url: string;
  title?: string;
}

// Новые типы для геометрии окна и экрана
export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  isFocused: boolean;
}

export interface ScreenGeometry {
  width: number;
  height: number;
  scaleFactor: number;
}

export interface SessionGeometry {
  screen: ScreenGeometry;
  window: WindowGeometry;
  displayCount: number;
}

// Новые типы для отслеживания приложений
export interface ProcessInfo {
  name: string;
  cmd: string;
  bin?: string;
  isSuspicious: boolean;
  isApplication: boolean;
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

export interface ProcessSnapshotData {
  processes: ProcessInfo[];
}

// Union type для всех событий активности
export type ActivityEvent =
  | { type: 'mouse_move'; timestamp: number; data: MouseMoveData }
  | { type: 'mouse_click'; timestamp: number; data: MouseClickData }
  | { type: 'key_down'; timestamp: number; data: KeyDownEventData }
  | { type: 'app_focus'; timestamp: number; data: AppFocusData }
  | { type: 'app_blur'; timestamp: number; data: AppBlurData }
  | { type: 'app_show'; timestamp: number; data: AppShowData }
  | { type: 'app_hide'; timestamp: number; data: AppHideData }
  | { type: 'app_open'; timestamp: number; data: AppOpenData }
  | { type: 'app_close'; timestamp: number; data: AppCloseData }
  | { type: 'page_navigate'; timestamp: number; data: PageNavigateData }
  | {
      type: 'screenshot_attempt';
      timestamp: number;
      data: ScreenshotAttemptData;
    }
  | { type: 'process_start'; timestamp: number; data: ProcessStartData }
  | { type: 'process_end'; timestamp: number; data: ProcessEndData };

export interface ActivitySession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  callUrl?: string;
  totalEvents: number;
  geometry?: SessionGeometry;
  processes: ProcessInfo[];
  isVirtual?: boolean;
  virtualHost?: string;
  systemResources?: SystemResourceInfo;
}
