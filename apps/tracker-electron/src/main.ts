import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow;
let browserWindow: BrowserWindow | null = null;

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
  let appPath: string;

  if (app.isPackaged) {
    // В production файлы находятся в extraResources (в папке Resources, на уровень выше app.asar)
    appPath = join(__dirname, '../../tracker-app/dist/index.html');
  } else {
    // В development используем относительный путь
    appPath = join(__dirname, '../../tracker-app/dist/index.html');
  }

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

function createBrowserWindow(url: string): void {
  if (browserWindow) {
    browserWindow.close();
  }

  browserWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Отключаем для Google Meet
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      // Убираем additionalArguments, которые могут выдавать Electron
    },
    title: 'Video Call',
    show: false, // Сначала скрываем окно
  });

  // Более реалистичный Chrome User Agent без упоминания Electron
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  browserWindow.webContents.setUserAgent(userAgent);

  // Переопределяем navigator.webdriver, чтобы скрыть автоматизацию
  browserWindow.webContents.on('dom-ready', () => {
    browserWindow?.webContents.executeJavaScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });

      if (window.process) {
        delete window.process;
      }
      if (window.require) {
        delete window.require;
      }
      if (window.module) {
        delete window.module;
      }
      if (window.global) {
        delete window.global;
      }
    `);

    // Показываем окно только после загрузки и настройки
    browserWindow?.show();
  });

  // Улучшенные заголовки для имитации реального браузера
  browserWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9,ru;q=0.8';
      details.requestHeaders['Accept'] =
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br, zstd';
      details.requestHeaders['Cache-Control'] = 'max-age=0';
      details.requestHeaders['Sec-Ch-Ua'] =
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
      details.requestHeaders['Sec-Ch-Ua-Mobile'] = '?0';
      details.requestHeaders['Sec-Ch-Ua-Platform'] = '"macOS"';
      details.requestHeaders['Sec-Fetch-Dest'] = 'document';
      details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
      details.requestHeaders['Sec-Fetch-Site'] = 'none';
      details.requestHeaders['Sec-Fetch-User'] = '?1';
      details.requestHeaders['Upgrade-Insecure-Requests'] = '1';

      // Убираем заголовки, которые могут выдать Electron
      delete details.requestHeaders[
        'X-DevTools-Emulate-Network-Conditions-Client-Id'
      ];

      callback({ requestHeaders: details.requestHeaders });
    }
  );

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

  browserWindow.loadURL(url);

  // Debug: Log page load events
  browserWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
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
    }
  );

  browserWindow.webContents.on('page-title-updated', (event, title) => {
    console.log('Page title updated:', title);
  });

  browserWindow.on('closed', () => {
    browserWindow = null;
  });
}

// IPC handlers
ipcMain.handle('open-url', async (event, url: string) => {
  try {
    // Validate URL
    new URL(url);
    createBrowserWindow(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Invalid URL' };
  }
});

// Add Chrome command line switches for better video call compatibility
app.commandLine.appendSwitch('--enable-media-stream');
app.commandLine.appendSwitch('--enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('--allow-http-screen-capture');
app.commandLine.appendSwitch('--auto-select-desktop-capture-source', 'Screen');
app.commandLine.appendSwitch('--enable-experimental-web-platform-features');
// Убираем --disable-web-security и --disable-site-isolation-trials
// Они могут выдавать автоматизированный браузер
app.commandLine.appendSwitch('--no-first-run');
app.commandLine.appendSwitch('--no-default-browser-check');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');

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
