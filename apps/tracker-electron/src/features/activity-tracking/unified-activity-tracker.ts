import { v7 } from 'uuid';
import { app, BrowserWindow, globalShortcut, screen } from 'electron';

import {
  ActivitySession,
  MouseMoveData,
  ActivityEvent,
  MouseClickData,
  PageNavigateData,
  SessionGeometry,
  WindowGeometry,
  ScreenGeometry,
  KeyDownEventData,
  ProcessStartData,
  ProcessEndData,
  ProcessSnapshotData,
} from './types.js';
import { ProcessTracker } from './process-tracking/process-tracker.js';
import { StorageAdapter } from './storage/storage-adapter.interface.js';

export class UnifiedActivityTracker {
  private session: ActivitySession | null = null;
  private isTracking = false;
  private lastState = {
    appFocused: false,
    appVisible: true,
  };
  private mouseInterval: NodeJS.Timeout | null = null;
  private geometryUpdateInterval: NodeJS.Timeout | null = null;
  private targetWindow: BrowserWindow | null = null;
  private lastKeyDownEvent: KeyDownEventData | null = null;
  private processTracker: ProcessTracker | null = null;

  constructor(private storageAdapter: StorageAdapter) {
    this.setupGlobalEventListeners();
    this.initializeProcessTracker();
  }

  private initializeProcessTracker(): void {
    this.processTracker = new ProcessTracker(
      {},
      (event) => this.handleProcessEvent(event),
      (data) => this.handleProcessSnapshot(data)
    );
  }

  private handleProcessEvent(event: {
    type: 'start' | 'end';
    data: ProcessStartData | ProcessEndData;
  }): void {
    if (!this.isTracking || !this.session) return;

    const timestamp = Date.now();

    switch (event.type) {
      case 'start':
        this.addEventToSession({
          type: 'process_start',
          timestamp,
          data: event.data as ProcessStartData,
        });
        break;

      case 'end':
        this.addEventToSession({
          type: 'process_end',
          timestamp,
          data: event.data as ProcessEndData,
        });
        break;
    }
  }

  private async handleProcessSnapshot(
    data: ProcessSnapshotData
  ): Promise<void> {
    if (!this.isTracking || !this.session) return;

    this.session.processes = data.processes;

    try {
      await this.storageAdapter.updateSession(this.session);
    } catch (error) {
      console.error('❌ Failed to update session:', error);
    }
  }

  public async initialize(): Promise<void> {
    if (!this.storageAdapter.isReady()) {
      await this.storageAdapter.initialize();
    }
    console.log('✅ Unified Activity Tracker initialized');
  }

  public async startTracking(
    callUrl: string,
    targetWindow?: BrowserWindow
  ): Promise<void> {
    console.log('🎯 Starting activity tracking for call:', callUrl);

    this.targetWindow = targetWindow || null;

    if (this.isTracking) {
      console.log('Tracking already active');
      return;
    }

    if (!this.storageAdapter.isReady()) {
      throw new Error('Storage adapter not initialized');
    }

    // Получаем геометрию сессии
    const geometry = this.getSessionGeometry();

    this.session = {
      sessionId: v7(),
      startTime: Date.now(),
      callUrl,
      totalEvents: 0,
      geometry,
      processes: [],
    };

    // Создаем сессию в хранилище
    await this.storageAdapter.createSession(this.session);

    this.isTracking = true;

    this.addAppOpenEvent();

    this.startMouseTracking();
    this.startGeometryMonitoring();
    this.registerScreenshotShortcuts();

    // Запускаем отслеживание процессов
    if (this.processTracker) {
      await this.processTracker.startTracking();
    }

    console.log(`🎯 Activity tracking started: ${this.session.sessionId}`);
  }

  public async stopTracking(): Promise<void> {
    if (!this.isTracking || !this.session) {
      return;
    }

    this.addAppBlurEvent();
    await new Promise((resolve) => setTimeout(resolve, 0)); // for order
    this.addAppCloseEvent();

    this.isTracking = false;

    if (this.mouseInterval) {
      clearInterval(this.mouseInterval);
      this.mouseInterval = null;
    }

    if (this.geometryUpdateInterval) {
      clearInterval(this.geometryUpdateInterval);
      this.geometryUpdateInterval = null;
    }

    this.session.endTime = Date.now();

    if (this.session.geometry) {
      this.session.geometry.window.isVisible = false;
      this.session.geometry.window.isFocused = false;
    }

    // Обновляем сессию в хранилище
    await this.storageAdapter.updateSession(this.session);

    console.log(
      `🛑 Activity tracking stopped: ${this.session.sessionId}, events: ${this.session.totalEvents}`
    );
    this.session = null;

    // Останавливаем отслеживание процессов
    if (this.processTracker) {
      await this.processTracker.stopTracking();
    }
  }

  public async destroy(): Promise<void> {
    await this.stopTracking();

    // Очищаем процесс трекер
    if (this.processTracker) {
      await this.processTracker.stopTracking();
      this.processTracker = null;
    }

    this.unregisterScreenshotShortcuts();
    await this.storageAdapter.destroy();
  }

  public setupMouseClickTracking(browserWindow: BrowserWindow): void {
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

      document.addEventListener('keydown', (e) => {
        console.log('Key down detected:', e.key);
        window.electronAPI.activityTracker.keyDown({code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey})
          .then(() => console.log('✅ Key down sent to main process'))
          .catch(err => console.error('❌ Failed to send key down:', err));
      });
    `;

    browserWindow.webContents
      .executeJavaScript(mouseClickScript)
      .catch((error) => {
        console.error('Failed to inject mouse click tracking:', error);
      });

    browserWindow.webContents.on('did-navigate', (_, navigationUrl) => {
      this.addPageNavigateEvent({ url: navigationUrl });
    });

    browserWindow.webContents.on('did-navigate-in-page', (_, navigationUrl) => {
      this.addPageNavigateEvent({ url: navigationUrl });
    });

    browserWindow.webContents.on('did-finish-load', () => {
      const currentUrl = browserWindow.webContents.getURL();
      const title = browserWindow.webContents.getTitle();

      console.log(`🌐 Initial page loaded: ${currentUrl}`);
      this.addPageNavigateEvent({ url: currentUrl, title: title });
    });
  }

  public addMouseClickEvent(x: number, y: number, button = 'left'): void {
    if (!this.isTracking) return;

    this.addMouseClickEventInternal({ x, y, button });
  }

  public addKeyDownEvent(event: KeyDownEventData): void {
    if (!this.isTracking) return;

    this.addKeyDownEventInternal(event);
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

  /**
   * Получает геометрию экрана и окна приложения
   */
  private getSessionGeometry(): SessionGeometry | undefined {
    try {
      // Получаем информацию о экране
      const primaryDisplay = screen.getPrimaryDisplay();
      const screenGeometry: ScreenGeometry = {
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height,
        scaleFactor: primaryDisplay.scaleFactor,
      };

      // Получаем информацию только о целевом окне
      if (!this.targetWindow || this.targetWindow.isDestroyed()) {
        // Не выводим предупреждение в консоль, просто возвращаем undefined
        return undefined;
      }

      const bounds = this.targetWindow.getBounds();
      const isVisible = this.targetWindow.isVisible();
      const isFocused = this.targetWindow.isFocused();

      const windowGeometry: WindowGeometry = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isVisible,
        isFocused,
      };

      return {
        screen: screenGeometry,
        window: windowGeometry,
        displayCount: screen.getAllDisplays().length || 1,
      };
    } catch (error) {
      console.error('❌ Error getting session geometry:', error);
      return undefined;
    }
  }

  /**
   * Проверяет и обновляет геометрию сессии если она изменилась
   */
  private async updateSessionGeometry(): Promise<void> {
    if (!this.session) return;

    // Не пытаемся получить геометрию если нет целевого окна
    if (!this.targetWindow || this.targetWindow.isDestroyed()) {
      return;
    }

    this.session.geometry = this.getSessionGeometry();

    // Сохраняем изменения в хранилище
    try {
      await this.storageAdapter.updateSession(this.session);
    } catch (error) {
      console.error('❌ Failed to update session geometry:', error);
    }
  }

  /**
   * Запускает периодическую проверку геометрии
   */
  private startGeometryMonitoring(): void {
    // Проверяем геометрию каждые 5 секунд (реже чем было)
    // и только если есть целевое окно
    this.geometryUpdateInterval = setInterval(() => {
      if (
        this.isTracking &&
        this.targetWindow &&
        !this.targetWindow.isDestroyed()
      ) {
        this.updateSessionGeometry().catch(console.error);
      }
    }, 5000);

    console.log('📐 Geometry monitoring started');
  }

  private addMouseClickEventInternal(data: MouseClickData): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'mouse_click',
      timestamp: Date.now(),
      data,
    });
  }

  private addKeyDownEventInternal(data: KeyDownEventData): void {
    if (!this.isTracking || !this.session) return;

    if (!this.isKeyCombination(data) || this.isDuplicateKeyDownEvent(data)) {
      return;
    }

    this.lastKeyDownEvent = data;

    this.addEventToSession({
      type: 'key_down',
      timestamp: Date.now(),
      data,
    });
  }

  private startMouseTracking(): void {
    console.log('🖱️ Starting mouse tracking...');

    this.mouseInterval = setInterval(() => {
      if (!this.isTracking) return;

      try {
        const mousePos = screen.getCursorScreenPoint();
        this.addMouseMoveEvent({ x: mousePos.x, y: mousePos.y });
      } catch (error) {
        console.error('❌ Error getting mouse position:', error);
        console.error('This might be due to macOS accessibility permissions');
      }
    }, 500);
  }

  private addMouseMoveEvent(data: MouseMoveData): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'mouse_move',
      timestamp: Date.now(),
      data,
    });
  }

  private addAppFocusEvent(): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'app_focus',
      timestamp: Date.now(),
      data: {},
    });
  }

  private addAppOpenEvent(): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'app_open',
      timestamp: Date.now(),
      data: {},
    });
  }

  private addAppCloseEvent(): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'app_close',
      timestamp: Date.now(),
      data: {},
    });
  }

  private addAppBlurEvent(): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'app_blur',
      timestamp: Date.now(),
      data: {},
    });
  }

  private addAppShowEvent(): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'app_show',
      timestamp: Date.now(),
      data: {},
    });
  }

  private addAppHideEvent(): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'app_hide',
      timestamp: Date.now(),
      data: {},
    });
  }

  private addPageNavigateEvent(data: PageNavigateData): void {
    if (!this.isTracking || !this.session) return;

    this.addEventToSession({
      type: 'page_navigate',
      timestamp: Date.now(),
      data,
    });
  }

  private addEventToSession(event: ActivityEvent): void {
    if (!this.session) return;

    this.session.totalEvents++;

    this.storageAdapter
      .saveEvent(this.session.sessionId, event)
      .catch((error) => {
        console.error('❌ Failed to save event through adapter:', error);
      });
  }

  private isKeyCombination(event: KeyDownEventData): boolean {
    return (
      (event.alt ||
        event.ctrl ||
        event.meta ||
        event.shift ||
        (event.code.includes('F') && event.code.length > 1)) &&
      ![
        'ShiftLeft',
        'ShiftRight',
        'ControlLeft',
        'ControlRight',
        'AltLeft',
        'AltRight',
        'MetaLeft',
        'MetaRight',
      ].includes(event.code)
    );
  }

  private isDuplicateKeyDownEvent(event: KeyDownEventData): boolean {
    if (!this.lastKeyDownEvent) return false;

    return (
      this.lastKeyDownEvent.code === event.code &&
      this.lastKeyDownEvent.shift === event.shift &&
      this.lastKeyDownEvent.ctrl === event.ctrl &&
      this.lastKeyDownEvent.alt === event.alt &&
      this.lastKeyDownEvent.meta === event.meta
    );
  }

  /**
   * Регистрирует глобальные горячие клавиши для отслеживания попыток скриншота
   */
  private registerScreenshotShortcuts(): void {
    try {
      if (process.platform === 'darwin') {
        // macOS shortcuts
        globalShortcut.register('CommandOrControl+Shift+3', () => {
          this.addScreenshotAttempt();
        });

        globalShortcut.register('CommandOrControl+Shift+4', () => {
          this.addScreenshotAttempt();
        });

        globalShortcut.register('CommandOrControl+Shift+5', () => {
          this.addScreenshotAttempt();
        });
      } else {
        // Windows shortcuts
        globalShortcut.register('PrintScreen', () => {
          this.addScreenshotAttempt();
        });

        globalShortcut.register('Alt+PrintScreen', () => {
          this.addScreenshotAttempt();
        });

        globalShortcut.register('CommandOrControl+PrintScreen', () => {
          this.addScreenshotAttempt();
        });

        globalShortcut.register('CommandOrControl+Shift+S', () => {
          this.addScreenshotAttempt();
        });
      }
    } catch (error) {
      console.error('❌ Failed to register screenshot shortcuts:', error);
    }
  }

  private addScreenshotAttempt(): void {
    if (!this.isTracking || !this.session) {
      console.log('⚠️ Screenshot attempt detected but tracking not active');
      return;
    }

    this.addEventToSession({
      type: 'screenshot_attempt',
      timestamp: Date.now(),
      data: {},
    });
  }

  /**
   * Отменяет регистрацию глобальных горячих клавиш
   */
  private unregisterScreenshotShortcuts(): void {
    try {
      globalShortcut.unregisterAll();
      console.log('🔧 Screenshot detection shortcuts unregistered');
    } catch (error) {
      console.error('❌ Failed to unregister screenshot shortcuts:', error);
    }
  }
}
