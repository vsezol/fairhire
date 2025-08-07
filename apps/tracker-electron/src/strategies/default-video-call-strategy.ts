import { BrowserWindow } from 'electron';
import {
  VideoCallStrategy,
  VideoCallConfig,
  VideoCallDelays,
} from './video-call-strategy.js';

export class DefaultVideoCallStrategy extends VideoCallStrategy {
  name = 'Default';

  canHandle(url: string): boolean {
    // Обрабатываем все URL, которые не обрабатывают специализированные стратегии
    return true;
  }

  async warmupSession(): Promise<void> {
    // Для обычных сайтов разогрев не требуется
    this.log('No warmup required for default strategy');
  }

  getWindowConfig(): VideoCallConfig {
    return {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      sessionPartition: 'persist:default-session',
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
        },
        title: 'Video Call',
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

        // Стандартные Chrome заголовки
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
    return `
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
  }

  getDelays(): VideoCallDelays {
    return {
      showDelay: 0,
      loadDelay: 0,
    };
  }

  /**
   * Проверяет, нужно ли повторить загрузку при ошибке did-fail-load
   */
  override shouldRetryOnError(errorCode: number, validatedURL: string): boolean {
    // CSP ошибки часто от сторонних ресурсов - не критичны
    if (errorCode === -30) {
      this.log('CSP error detected, likely from third-party resource, retrying...');
      return true;
    }

    return false;
  }

  /**
   * Проверяет, нужно ли использовать альтернативные URL при ошибке loadURL
   */
  override shouldUseAlternativeOnLoadError(): boolean {
    // Можем попробовать альтернативы для Default стратегии
    return true;
  }
}
