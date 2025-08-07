import { BrowserWindow, session } from 'electron';
import {
  VideoCallStrategy,
  VideoCallConfig,
  VideoCallDelays,
} from './video-call-strategy.js';

export class GoogleMeetStrategy extends VideoCallStrategy {
  name = 'GoogleMeet';
  private hasCookies = false;

  private static readonly CONFIG = {
    SESSION_PARTITION: 'persist:meet-session',
    USER_AGENT:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  };

  canHandle(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname === 'meet.google.com' ||
        parsedUrl.hostname.endsWith('.meet.google.com')
      );
    } catch {
      return false;
    }
  }

  async warmupSession(): Promise<void> {
    this.hasCookies = await this.checkGoogleMeetSession();

    if (this.hasCookies) {
      this.log('Session already exists, skipping warmup');
      return;
    }

    this.log('First time Google Meet launch detected, warming up session...');

    const warmupWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        partition: GoogleMeetStrategy.CONFIG.SESSION_PARTITION,
        devTools: false,
      },
    });

    warmupWindow.setMenu(null);

    try {
      this.log('Loading meet.google.com for session initialization...');
      await warmupWindow.loadURL('https://meet.google.com/', {
        userAgent: GoogleMeetStrategy.CONFIG.USER_AGENT,
      });

      // Ждем полной загрузки Meet
      await new Promise<void>((resolve) => {
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
                resolve();
              } else {
                setTimeout(checkReady, 500);
              }
            })
            .catch(() => {
              setTimeout(checkReady, 1000);
            });
        };
        checkReady();

        // Максимум 10 секунд ждем
        setTimeout(() => resolve(), 1000);
      });

      // Дополнительное время для полной инициализации JavaScript
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      this.log('Google Meet session warmup completed');
    } catch (error) {
      this.log('Session warmup failed:', error);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    } finally {
      warmupWindow.close();
    }
  }

  private async checkGoogleMeetSession(): Promise<boolean> {
    const meetSession = session.fromPartition(
      GoogleMeetStrategy.CONFIG.SESSION_PARTITION
    );
    const existingCookies = await meetSession.cookies.get({
      domain: '.google.com',
    });
    const hasCookies = existingCookies.length > 0;

    this.log(
      `Google Meet session status: ${
        hasCookies ? 'has cookies' : 'new session'
      } (${existingCookies.length} cookies)`
    );

    return hasCookies;
  }

  getWindowConfig(): VideoCallConfig {
    return {
      userAgent: GoogleMeetStrategy.CONFIG.USER_AGENT,
      sessionPartition: GoogleMeetStrategy.CONFIG.SESSION_PARTITION,
      windowConfig: {
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
          partition: GoogleMeetStrategy.CONFIG.SESSION_PARTITION,
        },
        title: 'Google Meet',
        show: false,
      },
    };
  }

  setupHeaders(browserWindow: BrowserWindow): void {
    browserWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        const headers = { ...details.requestHeaders };

        // Базовые заголовки
        headers['Accept-Language'] = 'en-US,en;q=0.9,ru;q=0.8';
        headers['Accept'] =
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
        headers['Accept-Encoding'] = 'gzip, deflate, br, zstd';

        // Актуальные Chrome заголовки для Google Meet
        headers['Sec-Ch-Ua'] =
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Platform'] = '"macOS"';

        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-Site'] = 'none';
        headers['Sec-Fetch-User'] = '?1';
        headers['Upgrade-Insecure-Requests'] = '1';

        // Удаляем подозрительные заголовки
        delete headers['X-DevTools-Emulate-Network-Conditions-Client-Id'];

        callback({ requestHeaders: headers });
      }
    );
  }

  getMaskingScript(): string {
    const baseScript = `
      // Базовая маскировка для всех сайтов
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

      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
    `;

    const googleMeetScript = `
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
    `;

    return baseScript + googleMeetScript;
  }

  getDelays(): VideoCallDelays {
    return {
      showDelay: this.hasCookies ? 500 : 1000, // Больше времени для первого запуска
      loadDelay: this.hasCookies ? 100 : 200, // Меньше задержки если сессия уже есть
    };
  }
}
