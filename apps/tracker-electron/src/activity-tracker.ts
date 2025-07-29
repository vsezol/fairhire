import { v7 } from 'uuid';
import { app, BrowserWindow, screen } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';

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

export class GlobalActivityTracker {
  private session: ActivitySession | null = null;
  private isTracking = false;
  private lastState = {
    appFocused: false,
    appVisible: true,
    isIdle: false,
    lastActivity: Date.now(),
  };
  private mouseInterval: NodeJS.Timeout | null = null;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private outputFile: string;

  constructor(
    outputPath: string = join(process.cwd(), 'activity-session.json')
  ) {
    this.outputFile = outputPath;
    this.setupGlobalEventListeners();
  }

  private setupGlobalEventListeners(): void {
    app.on('browser-window-focus', () => {
      if (!this.lastState.appFocused) {
        this.lastState.appFocused = true;
        this.addAppFocusEvent();
      }
    });

    app.on('browser-window-blur', () => {
      if (this.lastState.appFocused) {
        this.lastState.appFocused = false;
        this.addAppBlurEvent();
      }
    });

    app.on('activate', () => {
      if (!this.lastState.appVisible) {
        this.lastState.appVisible = true;
        this.addAppShowEvent();
      }
    });

    app.on('before-quit', () => {
      if (this.lastState.appVisible) {
        this.lastState.appVisible = false;
        this.addAppHideEvent();
      }
    });
  }

  public async startTracking(callUrl: string): Promise<void> {
    if (this.isTracking) {
      console.log('Tracking already active');
      return;
    }

    this.session = {
      sessionId: v7(),
      startTime: Date.now(),
      callUrl,
      totalEvents: 0,
    };

    this.isTracking = true;
    this.lastState.lastActivity = Date.now();

    this.startMouseTracking();
    this.startIdleDetection();
    this.addAppFocusEvent();

    console.log(`🎯 Activity tracking started: ${this.session.sessionId}`);
  }

  public async stopTracking(): Promise<void> {
    if (!this.isTracking || !this.session) {
      return;
    }

    this.isTracking = false;

    if (this.mouseInterval) {
      clearInterval(this.mouseInterval);
      this.mouseInterval = null;
    }

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    this.addAppBlurEvent();
    this.session.endTime = Date.now();

    await this.saveSession();

    console.log(
      `🛑 Activity tracking stopped: ${this.session.sessionId}, events: ${this.session.totalEvents}`
    );
    this.session = null;
  }

  private startMouseTracking(): void {
    console.log('🖱️ Starting mouse tracking...');

    this.mouseInterval = setInterval(() => {
      if (!this.isTracking) return;

      try {
        const mousePos = screen.getCursorScreenPoint();
        this.updateActivity();
        this.addMouseMoveEvent({ x: mousePos.x, y: mousePos.y });
      } catch (error) {
        console.error('❌ Error getting mouse position:', error);
        console.error('This might be due to macOS accessibility permissions');
      }
    }, 500);
  }

  private startIdleDetection(): void {
    const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 минут

    this.idleCheckInterval = setInterval(() => {
      if (!this.isTracking) return;

      const now = Date.now();
      const timeSinceActivity = now - this.lastState.lastActivity;

      if (timeSinceActivity > IDLE_THRESHOLD && !this.lastState.isIdle) {
        this.lastState.isIdle = true;
        this.addIdleStartEvent({ idleDuration: timeSinceActivity });
      } else if (timeSinceActivity <= IDLE_THRESHOLD && this.lastState.isIdle) {
        this.lastState.isIdle = false;
        this.addIdleEndEvent({ idleDuration: timeSinceActivity });
      }
    }, 30000); // Проверяем каждые 30 секунд
  }

  private updateActivity(): void {
    this.lastState.lastActivity = Date.now();
  }

  private addMouseMoveEvent(data: MouseMoveData): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'mouse_move',
      timestamp: Date.now(),
      data,
    };

    this.addEventToSession(event);
  }

  private addMouseClickEventInternal(data: MouseClickData): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'mouse_click',
      timestamp: Date.now(),
      data,
    };

    this.addEventToSession(event);
  }

  private addAppFocusEvent(): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'app_focus',
      timestamp: Date.now(),
      data: {},
    };

    this.addEventToSession(event);
  }

  private addAppBlurEvent(): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'app_blur',
      timestamp: Date.now(),
      data: {},
    };

    this.addEventToSession(event);
  }

  private addAppShowEvent(): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'app_show',
      timestamp: Date.now(),
      data: {},
    };

    this.addEventToSession(event);
  }

  private addAppHideEvent(): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'app_hide',
      timestamp: Date.now(),
      data: {},
    };

    this.addEventToSession(event);
  }

  private addIdleStartEvent(data: IdleStartData): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'idle_start',
      timestamp: Date.now(),
      data,
    };

    this.addEventToSession(event);
  }

  private addIdleEndEvent(data: IdleEndData): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'idle_end',
      timestamp: Date.now(),
      data,
    };

    this.addEventToSession(event);
  }

  private addPageNavigateEvent(data: PageNavigateData): void {
    if (!this.isTracking || !this.session) return;

    const event: ActivityEvent = {
      type: 'page_navigate',
      timestamp: Date.now(),
      data,
    };

    this.addEventToSession(event);
  }

  private addEventToSession(event: ActivityEvent): void {
    if (!this.session) return;

    this.session.totalEvents++;

    this.saveEventToFile(event).catch(console.error);
  }

  private async saveEventToFile(event: ActivityEvent): Promise<void> {
    if (!this.session) return;

    const logEntry = {
      sessionId: this.session.sessionId,
      event,
      timestamp: new Date().toISOString(),
    };

    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(
        this.outputFile.replace('.json', '.jsonl'),
        logLine,
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.session) return;

    try {
      const sessionData = {
        ...this.session,
        savedAt: new Date().toISOString(),
        duration: this.session.endTime
          ? this.session.endTime - this.session.startTime
          : 0,
        platform: process.platform,
        appVersion: app.getVersion(),
      };

      await fs.writeFile(
        this.outputFile,
        JSON.stringify(sessionData, null, 2),
        'utf-8'
      );
      console.log(`💾 Session saved: ${this.outputFile}`);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  public destroy(): void {
    this.stopTracking();
  }

  public setupMouseClickTracking(browserWindow: BrowserWindow): void {
    console.log('🖱️ Setting up mouse click tracking for browser window');

    // Че за говно?
    // browserWindow.webContents.on('before-input-event', (event, input) => {
    //   if (input.type === 'mouseDown') {
    //     // input не содержит информацию о кнопке мыши, используем 'left' по умолчанию
    //     console.log(`🖱️ Native mouse click detected`);
    //     this.addMouseClickEvent(-1, -1, 'left'); // -1,-1 так как координаты недоступны в этом событии
    //   }
    // });

    // Инжектируем скрипт для отслеживания кликов мыши
    const mouseClickScript = `
      console.log('🖱️ Mouse click tracking injected');

      // Функция для безопасной отправки клика
      function sendMouseClick(x, y, button) {
        if (window.electronAPI && window.electronAPI.activityTracker && window.electronAPI.activityTracker.mouseClick) {
          window.electronAPI.activityTracker.mouseClick(x, y, button)
            .then(() => console.log('✅ Mouse click sent to main process:', button, 'at', x, y))
            .catch(err => console.error('❌ Failed to send mouse click:', err));
        } else {
          console.warn('⚠️ electronAPI.activityTracker.mouseClick not available yet');
        }
      }

      // Ждем несколько секунд для загрузки electronAPI
      setTimeout(() => {
        if (window.electronAPI && window.electronAPI.activityTracker) {
          console.log('✅ electronAPI ready for mouse tracking');
        } else {
          console.warn('❌ electronAPI still not available after 3 seconds');
        }
      }, 3000);

      document.addEventListener('click', (e) => {
        console.log('Mouse click detected:', e.clientX, e.clientY);

        const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';
        const x = e.clientX;
        const y = e.clientY;

        sendMouseClick(x, y, button);
      }, true);

      document.addEventListener('contextmenu', (e) => {
        console.log('Right click detected:', e.clientX, e.clientY);

        // Также отслеживаем правые клики
        if (window.electronAPI && window.electronAPI.activityTracker && window.electronAPI.activityTracker.mouseClick) {
          window.electronAPI.activityTracker.mouseClick(e.clientX, e.clientY, 'right')
            .then(() => console.log('✅ Right click sent to main process'))
            .catch(err => console.error('❌ Failed to send right click:', err));
        }
      }, true);

      document.addEventListener('mousedown', (e) => {
        if (e.button === 1) { // Middle button
          console.log('Middle click detected:', e.clientX, e.clientY);
          if (window.electronAPI && window.electronAPI.activityTracker && window.electronAPI.activityTracker.mouseClick) {
            window.electronAPI.activityTracker.mouseClick(e.clientX, e.clientY, 'middle')
              .then(() => console.log('✅ Middle click sent to main process'))
              .catch(err => console.error('❌ Failed to send middle click:', err));
          }
        }
      }, true);
    `;

    browserWindow.webContents
      .executeJavaScript(mouseClickScript)
      .catch((error) => {
        console.error('Failed to inject mouse click tracking:', error);
      });

    console.log('🌐 Setting up page navigation tracking');

    browserWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      console.log(`🌐 Page navigated to: ${navigationUrl}`);
      this.addPageNavigateEvent({ url: navigationUrl });
    });

    browserWindow.webContents.on(
      'did-navigate-in-page',
      (event, navigationUrl) => {
        console.log(`🌐 In-page navigation to: ${navigationUrl}`);
        this.addPageNavigateEvent({ url: navigationUrl });
      }
    );

    browserWindow.webContents.on('did-finish-load', () => {
      const currentUrl = browserWindow.webContents.getURL();
      const title = browserWindow.webContents.getTitle();

      console.log(`🌐 Initial page loaded: ${currentUrl}`);
      this.addPageNavigateEvent({ url: currentUrl, title: title });
    });
  }

  public addMouseClickEvent(x: number, y: number, button = 'left'): void {
    if (!this.isTracking) return;

    this.updateActivity();
    this.addMouseClickEventInternal({ x, y, button });
  }
}

let globalTracker: GlobalActivityTracker | null = null;

export function initializeActivityTracker(
  outputPath?: string
): GlobalActivityTracker {
  if (globalTracker) {
    return globalTracker;
  }

  globalTracker = new GlobalActivityTracker(outputPath);

  app.on('before-quit', () => {
    if (globalTracker) {
      globalTracker.destroy();
    }
  });

  return globalTracker;
}

export function getActivityTracker(): GlobalActivityTracker | null {
  return globalTracker;
}
