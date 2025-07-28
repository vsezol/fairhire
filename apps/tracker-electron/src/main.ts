import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow;
let browserWindow: BrowserWindow | null = null;

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Функция для предварительного разогрева сессии
async function warmupGoogleSession(): Promise<void> {
  console.log('Warming up Google Meet session...');

  const warmupWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      partition: 'persist:meet-session',
    },
  });

  try {
    // Сначала загружаем Google Meet напрямую для полной инициализации
    console.log('Loading meet.google.com for session initialization...');
    await warmupWindow.loadURL('https://meet.google.com/', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    // Ждем полной загрузки Meet
    await new Promise((resolve) => {
      const checkReady = () => {
        warmupWindow.webContents
          .executeJavaScript(
            `
          document.readyState === 'complete' &&
          window.location.hostname === 'meet.google.com' &&
          document.querySelector('body') !== null
        `
          )
          .then((ready) => {
            if (ready) {
              resolve(true);
            } else {
              setTimeout(checkReady, 500);
            }
          })
          .catch(() => {
            setTimeout(checkReady, 500);
          });
      };
      checkReady();

      // Максимум 10 секунд ждем
      setTimeout(() => resolve(true), 10000);
    });

    // Дополнительное время для полной инициализации JavaScript
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('Google Meet session warmup completed');
  } catch (error) {
    console.log('Session warmup failed:', error);
    // Даже при ошибке ждем немного - возможно частично инициализировалось
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } finally {
    warmupWindow.close();
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Необходимо для ES modules в preload
      preload: join(__dirname, 'preload.js'), // Изменено на .mjs
      // devTools: false, // TODO for PROD
    },
    resizable: false,
    maximizable: false,
    title: 'AntiCheat Interview',
  });

  // Определяем путь к HTML файлу в зависимости от режима (dev/prod)
  const appPath = join(__dirname, '../../tracker-app/dist/index.html');

  console.log('Loading app from:', appPath);
  mainWindow.loadFile(appPath);

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

      // In development, if Vite server is not running, show error
      if (
        process.env.NODE_ENV === 'development' &&
        validatedURL.includes('localhost:4200')
      ) {
        console.log(
          'Make sure the tracker-app dev server is running on port 4200'
        );
      }
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

  // Предварительно разогреваем сессию если это первый запуск
  const meetSession = session.fromPartition('persist:meet-session');
  const existingCookies = await meetSession.cookies.get({
    domain: '.google.com',
  });
  const hasCookies = existingCookies.length > 0;

  console.log(
    `Session status: ${hasCookies ? 'has cookies' : 'new session'} (${
      existingCookies.length
    } cookies)`
  );

  if (!hasCookies) {
    console.log('First time launch detected, warming up session...');
    await warmupGoogleSession();
  }

  // Функция создания окна с retry логикой
  const createWindowWithRetry = async (
    retryCount = 0
  ): Promise<BrowserWindow> => {
    if (browserWindow) {
      try {
        browserWindow.close();
      } catch (error) {
        console.log('Error closing browser window:', error);
      }
    }

    browserWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: true,
        backgroundThrottling: false,
        spellcheck: false,
        partition: 'persist:meet-session',
      },
      title: 'Video Call',
      show: false,
    });

    // Современный User Agent
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    browserWindow.webContents.setUserAgent(userAgent);

    // Настройка CSP и заголовков перед загрузкой
    browserWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        const headers = { ...details.requestHeaders };

        // Базовые заголовки
        headers['Accept-Language'] = 'en-US,en;q=0.9,ru;q=0.8';
        headers['Accept'] =
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
        headers['Accept-Encoding'] = 'gzip, deflate, br, zstd';

        // Актуальные Chrome заголовки
        headers['Sec-Ch-Ua'] =
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Platform'] = '"macOS"';

        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-Site'] = 'none';
        headers['Sec-Fetch-User'] = '?1';
        headers['Upgrade-Insecure-Requests'] = '1';

        // Удаляем только явно подозрительные заголовки
        delete headers['X-DevTools-Emulate-Network-Conditions-Client-Id'];

        callback({ requestHeaders: headers });
      }
    );

    // Исправляем CSP проблемы
    browserWindow.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        const responseHeaders = { ...details.responseHeaders };

        // Смягчаем CSP для Google Meet
        if (responseHeaders['content-security-policy']) {
          responseHeaders['content-security-policy'] = responseHeaders[
            'content-security-policy'
          ].map((csp) => {
            return csp.replace(/script-src[^;]*;/g, (match) => {
              // Разрешаем все скрипты с meet.google.com
              if (!match.includes('https://meet.google.com')) {
                return match.replace(
                  'https://meet.google.com/_/scs/mss-static/_/js/',
                  'https://meet.google.com/_/scs/mss-static/_/'
                );
              }
              return match;
            });
          });
        }

        callback({ responseHeaders });
      }
    );

    // Упрощенная маскировка без блокировки консоли
    browserWindow.webContents.on('dom-ready', () => {
      browserWindow?.webContents
        .executeJavaScript(
          `
        // Базовая маскировка
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });

        // Реалистичные plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => ({
            length: 3,
            0: { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
            1: { name: 'Chromium PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
            2: { name: 'Microsoft Edge PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' }
          }),
          configurable: true
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'ru'],
          configurable: true
        });

        // Удаляем Node.js следы более аккуратно
        const objectsToDelete = ['process', 'require', 'module', 'global', 'Buffer', 'clearImmediate', 'setImmediate'];
        objectsToDelete.forEach(obj => {
          if (window[obj]) {
            try {
              delete window[obj];
            } catch (e) {
              window[obj] = undefined;
            }
          }
        });

        // Добавляем реалистичные свойства
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
          configurable: true
        });

        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
          configurable: true
        });

        // НЕ блокируем console.log - это ломает Google Meet
        // Только маскируем webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
          configurable: true
        });

        // Дополнительная маскировка для первого запуска
        if (!window.__meetInitialized) {
          window.__meetInitialized = true;

          // Имитируем наличие истории браузера
          if (window.history && window.history.length < 2) {
            try {
              window.history.pushState({}, '', window.location.href);
            } catch (e) {}
          }

          // Добавляем реалистичные времена
          Object.defineProperty(window.performance, 'timeOrigin', {
            get: () => Date.now() - Math.floor(Math.random() * 10000),
            configurable: true
          });
        }
      `
        )
        .catch((error) => {
          console.log('Error executing JavaScript:', error);
        });

      // Показываем окно с задержкой в зависимости от того, первый ли это запуск
      const delay = hasCookies ? 500 : 3000; // Еще больше времени для первого запуска
      setTimeout(() => {
        browserWindow?.show();
      }, delay + Math.random() * 500);
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
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Промис для отслеживания успешной загрузки
    return new Promise((resolve, reject) => {
      let isResolved = false;
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

      // Таймаут для всей операции
      const timeout = setTimeout(() => {
        rejectOnce(new Error('Load timeout'));
      }, 30000);

      if (browserWindow) {
        browserWindow.webContents.on('did-finish-load', () => {
          console.log('Page loaded successfully');
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

            clearTimeout(timeout);

            // Критические ошибки, которые требуют retry
            if (
              (errorCode === -101 ||
                errorCode === -105 ||
                errorCode === -106 ||
                errorCode === -2) &&
              retryCount < 2
            ) {
              console.log(`Retrying load (attempt ${retryCount + 1}/2)...`);

              setTimeout(async () => {
                try {
                  const retryWindow = await createWindowWithRetry(
                    retryCount + 1
                  );
                  resolveOnce(retryWindow);
                } catch (error) {
                  rejectOnce(error);
                }
              }, 5000); // 5 секунд между попытками
            } else {
              rejectOnce(
                new Error(`Load failed: ${errorDescription} (${errorCode})`)
              );
            }
          }
        );

        browserWindow.on('closed', () => {
          browserWindow = null;
          clearTimeout(timeout);
          rejectOnce(new Error('Window closed'));
        });
      } else {
        rejectOnce(new Error('Browser window not created'));
      }

      // Загрузка URL с адаптивной задержкой
      const loadDelay = hasCookies ? 100 : 2000; // Меньше задержки если сессия уже есть
      setTimeout(() => {
        if (browserWindow && !browserWindow.isDestroyed()) {
          console.log(
            `Loading URL with ${
              hasCookies ? 'existing' : 'new'
            } session (attempt ${retryCount + 1})...`
          );
          browserWindow.loadURL(url).catch((error) => {
            console.log('Error loading URL:', error);
            rejectOnce(error);
          });
        } else {
          rejectOnce(new Error('Browser window destroyed'));
        }
      }, loadDelay);
    });
  };

  // Запускаем создание окна с retry логикой
  try {
    await createWindowWithRetry();
    console.log('Browser window created successfully');
  } catch (error) {
    console.error('Failed to create browser window after retries:', error);
    throw error;
  }

  // Дополнительные обработчики событий
  if (browserWindow) {
    browserWindow.webContents.on('page-title-updated', (event, title) => {
      console.log('Page title updated:', title);
    });

    // Обработка необработанных исключений в renderer процессе
    browserWindow.webContents.on('render-process-gone', (event, details) => {
      console.log('Renderer process gone:', details);
    });
  }
}

// IPC handlers
ipcMain.handle('open-url', async (event, url: string) => {
  try {
    // Validate URL
    new URL(url);
    await createBrowserWindow(url);
    return { success: true };
  } catch (error) {
    console.error('Error in open-url handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid URL',
    };
  }
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

// Убираем агрессивные SSL флаги
// НЕ используем --ignore-ssl-errors и подобные

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation except through our handler
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
