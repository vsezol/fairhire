import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  VideoCallStrategy,
  VideoCallStrategyFactory,
} from './strategies/index.js';
import {
  UnifiedActivityTracker,
  createSmartAutoAdapter,
} from './features/activity-tracking/index.js';
import { screenshotProtectionService } from './features/screenshot-protection/index.js';
import { KeyDownEvent } from './preload.js';
import { APP_VERSION } from './version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow;
let browserWindow: BrowserWindow | null = null;
let activityTracker: UnifiedActivityTracker;

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 300,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Необходимо для ES modules в preload
      preload: join(__dirname, 'preload.js'),
      devTools: false,
    },
    resizable: false,
    maximizable: false,
    title: titleWithVersion('FairHire'),
  });

  mainWindow.setMenu(null);

  screenshotProtectionService.protectWindow(mainWindow);

  // Определяем путь к HTML файлу в зависимости от режима (dev/prod)
  const appPath = join(__dirname, '../../tracker-app/dist/index.html');

  console.log('Loading app from:', appPath);
  mainWindow.loadFile(appPath);

  mainWindow.webContents.on('page-title-updated', (event, title) => {
    mainWindow.setTitle(titleWithVersion(title));
  });

  mainWindow.on('closed', () => {
    if (browserWindow) {
      browserWindow.close();
    }
    app.quit();
  });

  // Handle page load errors
  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL) => {
      console.log(
        'Main window failed to load:',
        errorCode,
        errorDescription,
        validatedURL
      );
    }
  );
}

async function createBrowserWindow(url: string): Promise<void> {
  if (browserWindow) {
    try {
      browserWindow.close();
    } catch (error) {
      console.log('Error closing previous browser window:', error);
    }
  }

  const strategy = VideoCallStrategyFactory.getStrategy(url);
  await strategy.warmupSession();

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Creating browser window (attempt ${attempt}/${maxRetries})...`
      );
      await createWindow(strategy, url);
      console.log('Browser window created successfully');
      break;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt} failed:`, error);

      // Проверяем, является ли ошибка retryable
      const isRetryableError = lastError.message.includes('Retryable error:');

      if (attempt < maxRetries && isRetryableError) {
        console.log(
          `Retrying in 5 seconds... (attempt ${attempt + 1}/${maxRetries})`
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (attempt === maxRetries) {
        // Последняя попытка не удалась
        console.error(
          'Failed to create browser window after all retries:',
          lastError
        );
        throw lastError;
      } else {
        // Не retryable ошибка, не пытаемся снова
        console.error('Non-retryable error, stopping attempts:', lastError);
        throw lastError;
      }
    }
  }

  // Дополнительные обработчики событий
  if (browserWindow) {
    browserWindow.webContents.on('page-title-updated', (event, title) => {
      browserWindow?.setTitle(titleWithVersion(title));
    });

    // Обработка необработанных исключений в renderer процессе
    browserWindow.webContents.on('render-process-gone', (event, details) => {
      console.log('Renderer process gone:', details);
    });
  }
}

async function createWindow(
  strategy: VideoCallStrategy,
  url: string
): Promise<BrowserWindow> {
  if (browserWindow) {
    try {
      browserWindow.close();
    } catch (error) {
      console.log('Error closing browser window:', error);
    }
  }

  // Получаем конфигурацию от стратегии
  const config = strategy.getWindowConfig();

  browserWindow = new BrowserWindow({
    ...config.windowConfig,
    autoHideMenuBar: true,
    webPreferences: {
      ...config.windowConfig.webPreferences,
      partition: config.sessionPartition,
      sandbox: false,
      preload: join(__dirname, 'preload.js'),
      devTools: false,
    },
  });

  browserWindow.setMenu(null);

  // Устанавливаем User Agent
  browserWindow.webContents.setUserAgent(config.userAgent);

  // Настраиваем заголовки через стратегию
  strategy.setupHeaders(browserWindow);

  // Маскировка браузера
  browserWindow.webContents.on('dom-ready', () => {
    const maskingScript = strategy.getMaskingScript();

    browserWindow?.webContents
      .executeJavaScript(maskingScript)
      .catch((error) => {
        console.log('Error executing JavaScript:', error);
      });

    // Показываем окно с задержкой
    const delays = strategy.getDelays();
    setTimeout(() => {
      browserWindow?.show();
    }, delays.showDelay + Math.random() * 500);
  });

  // Set permissions for media access
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowedPermissions = [
        'camera',
        'microphone',
        'notifications',
        'display-capture',
        'media',
        'mediaKeySystem',
        'geolocation',
        'fullscreen',
        'pointerLock',
      ];
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  // Handle external links
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Блокируем zoomus:// ссылки
    if (url.startsWith('zoomus://')) {
      console.log('Blocked external zoomus:// link:', url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Защищаем браузерное окно от скриншотов
  if (browserWindow) {
    screenshotProtectionService.protectWindow(browserWindow);
    console.log('🛡️ Browser window protected from screenshots');
  }

  // Промис для отслеживания успешной загрузки
  return new Promise((resolve, reject) => {
    let isResolved = false;
    let retryCount = 0;

    const resolveOnce = (result: BrowserWindow) => {
      if (!isResolved) {
        isResolved = true;
        resolve(result);
      }
    };

    const rejectOnce = (error: any) => {
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    };

    // Подготавливаем URL через стратегию
    const preparedUrls = strategy.prepareUrls(url);
    const alternativeUrls = preparedUrls.alternativeUrls;

    // Функция для попытки загрузки с альтернативным URL
    const tryLoadAlternative = () => {
      if (retryCount < alternativeUrls.length) {
        const alternativeUrl = alternativeUrls[retryCount];
        console.log(
          `Trying alternative URL (${retryCount + 1}/${
            alternativeUrls.length
          }):`,
          alternativeUrl
        );
        retryCount++;

        setTimeout(() => {
          if (browserWindow && !browserWindow.isDestroyed()) {
            browserWindow.loadURL(alternativeUrl).catch((error) => {
              console.log('Error loading alternative URL:', error);
              if (retryCount < alternativeUrls.length) {
                tryLoadAlternative();
              } else {
                rejectOnce(new Error('All alternative URLs failed'));
              }
            });
          }
        }, 1000);
      } else {
        rejectOnce(new Error('No more alternative URLs to try'));
      }
    };

    // Таймаут для всей операции
    const timeout = setTimeout(() => {
      rejectOnce(new Error('Load timeout'));
    }, 30000);

    if (browserWindow) {
      browserWindow.webContents.on('did-finish-load', () => {
        console.log('Page loaded successfully');

        console.log('🖱️ Setting up mouse click tracking after page load...');
        activityTracker.setupMouseClickTracking(browserWindow!);

        clearTimeout(timeout);
        resolveOnce(browserWindow!);
      });

      browserWindow.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL) => {
          console.log(
            'Page failed to load:',
            errorCode,
            errorDescription,
            validatedURL
          );

          // Специальная обработка CSP ошибок
          if (errorCode === -30 && validatedURL.includes('metrika')) {
            console.log('Ignoring CSP error from analytics/tracking service');
            return; // Игнорируем CSP ошибки от аналитики
          }

          // Проверяем через стратегию, нужно ли повторить попытку
          if (strategy.shouldRetryOnError(errorCode, validatedURL)) {
            console.log('Strategy suggests retry, trying alternative URL...');
            tryLoadAlternative();
            return;
          }

          clearTimeout(timeout);

          // Проверяем критические ошибки, которые могут быть исправлены retry
          const isRetryableError =
            errorCode === -101 ||
            errorCode === -105 ||
            errorCode === -106 ||
            errorCode === -2 ||
            errorCode === -30; // CSP errors are often non-critical (ads, analytics)

          if (isRetryableError) {
            rejectOnce(
              new Error(`Retryable error: ${errorDescription} (${errorCode})`)
            );
          } else {
            rejectOnce(
              new Error(`Load failed: ${errorDescription} (${errorCode})`)
            );
          }
        }
      );

      browserWindow.on('closed', async () => {
        await activityTracker.stopTracking().catch(console.error);
        console.log('Activity tracking stopped due to window close');

        browserWindow = null;
        clearTimeout(timeout);
        rejectOnce(new Error('Window closed'));
      });
    } else {
      rejectOnce(new Error('Browser window not created'));
    }

    // Загрузка URL с адаптивной задержкой
    const delays = strategy.getDelays();
    const loadDelay = delays.loadDelay || 100;

    setTimeout(() => {
      if (browserWindow && !browserWindow.isDestroyed()) {
        console.log(`Loading ${strategy.name} strategy for URL...`);
        browserWindow.loadURL(preparedUrls.primaryUrl).catch((error) => {
          console.log('Error loading URL:', error);
          if (strategy.shouldUseAlternativeOnLoadError()) {
            tryLoadAlternative();
          }
        });
      }
    }, loadDelay);
  });
}

// IPC handlers
ipcMain.handle('open-url', async (event, url: string) => {
  try {
    // Validate URL
    new URL(url);
    await createBrowserWindow(url);

    if (activityTracker) {
      await activityTracker.startTracking(url, browserWindow!);
      console.log('Activity tracking started for call:', url);
    }

    return { success: true };
  } catch (error) {
    console.error('Error in open-url handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid URL',
    };
  }
});

ipcMain.handle(
  'activity-tracker:mouse-click',
  (_, x: number, y: number, button?: string) => {
    if (!activityTracker) {
      return { success: false, error: 'Activity tracker not initialized' };
    }
    activityTracker.addMouseClickEvent(x, y, button);
    return { success: true };
  }
);
ipcMain.handle('activity-tracker:key-down', (_, event: KeyDownEvent) => {
  if (!activityTracker) {
    return { success: false, error: 'Activity tracker not initialized' };
  }
  activityTracker.addKeyDownEvent(event);
  return { success: true };
});

// Add Chrome command line switches for better video call compatibility
app.commandLine.appendSwitch('--enable-media-stream');
app.commandLine.appendSwitch('--enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('--allow-http-screen-capture');
app.commandLine.appendSwitch('--auto-select-desktop-capture-source', 'Screen');
app.commandLine.appendSwitch('--enable-experimental-web-platform-features');

// Более мягкая маскировка
app.commandLine.appendSwitch('--disable-blink-features=AutomationControlled');
app.commandLine.appendSwitch('--no-first-run');
app.commandLine.appendSwitch('--no-default-browser-check');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');

// Улучшения производительности и стабильности
app.commandLine.appendSwitch(
  '--enable-features=VaapiVideoDecoder,WebRTCPipeWireCapturer'
);
app.commandLine.appendSwitch('--disable-features=TranslateUI');
app.commandLine.appendSwitch('--enable-gpu-rasterization');
app.commandLine.appendSwitch('--enable-zero-copy');

// Дополнительные флаги для стабильности SSL
app.commandLine.appendSwitch('--enable-tls13-early-data');
app.commandLine.appendSwitch('--disable-dev-shm-usage');

// НОВЫЕ ФЛАГИ ДЛЯ РЕШЕНИЯ ПРОБЛЕМЫ С ZOOM И QUIC ПРОТОКОЛОМ
app.commandLine.appendSwitch('--disable-quic');
app.commandLine.appendSwitch('--disable-http2');
app.commandLine.appendSwitch('--disable-features=VizDisplayCompositor');
app.commandLine.appendSwitch('--ignore-certificate-errors');
app.commandLine.appendSwitch('--ignore-ssl-errors');
app.commandLine.appendSwitch('--ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--allow-running-insecure-content');
app.commandLine.appendSwitch('--disable-site-isolation-trials');

app.whenReady().then(async () => {
  const adapter = await createSmartAutoAdapter({
    jsonOutputPath: join(process.cwd(), 'activity-session.json'),
    preferSupabase: true, // Попробует Supabase, автоматический fallback на JSON
  });

  activityTracker = new UnifiedActivityTracker(adapter);
  await activityTracker.initialize(); // Проверит готовность адаптера

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Stop tracking when app closes
  if (activityTracker) {
    await activityTracker.destroy().catch(console.error);
  }

  screenshotProtectionService.cleanup();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  screenshotProtectionService.cleanup();
});

// Security: Prevent new window creation except through our handler
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

function titleWithVersion(title: string): string {
  return `${title} ${APP_VERSION}`;
}
