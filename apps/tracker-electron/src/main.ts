import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow;
let browserWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    resizable: false,
    maximizable: false,
    title: 'AntiCheat Interview',
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    if (browserWindow) {
      browserWindow.close();
    }
    app.quit();
  });
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
      webSecurity: false, // Needed for some video call platforms
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      additionalArguments: [
        '--enable-features=VaapiVideoDecoder',
        '--disable-features=VizDisplayCompositor',
      ],
    },
    title: 'Video Call',
  });

  // Set Chrome-like user agent to bypass browser detection
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  browserWindow.webContents.setUserAgent(userAgent);

  // Additional headers to make it look like a real browser
  browserWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
      details.requestHeaders['Accept'] =
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
      details.requestHeaders['Cache-Control'] = 'no-cache';
      details.requestHeaders['Pragma'] = 'no-cache';

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
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--disable-site-isolation-trials');
app.commandLine.appendSwitch('--disable-features=VizDisplayCompositor');

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
