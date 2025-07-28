import { BrowserWindow } from 'electron';
import {
  VideoCallStrategy,
  VideoCallConfig,
  VideoCallDelays,
} from './video-call-strategy.js';

export class ZoomStrategy extends VideoCallStrategy {
  name = 'Zoom';

  canHandle(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname.includes('zoom.us') ||
        parsedUrl.hostname.includes('zoom.com') ||
        parsedUrl.hostname.endsWith('.zoom.us') ||
        parsedUrl.hostname.endsWith('.zoom.com')
      );
    } catch {
      return false;
    }
  }

  async warmupSession(): Promise<void> {
    this.log('Warming up Zoom session...');
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.log('Zoom session warmup completed');
  }

  getWindowConfig(): VideoCallConfig {
    return {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      sessionPartition: 'persist:zoom-session',
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
          safeDialogs: true,
          safeDialogsMessage:
            'This page has been disabled for security reasons.',
          disableDialogs: false,
        },
        title: 'Zoom Meeting',
        show: false,
      },
    };
  }

  setupHeaders(browserWindow: BrowserWindow): void {
    // Перехватываем попытки навигации на zoomus:// протокол
    browserWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      if (navigationUrl.startsWith('zoomus://')) {
        this.log('Blocking navigation to native Zoom app:', navigationUrl);
        event.preventDefault();

        // Пытаемся остаться на веб-версии
        this.forceStayOnWeb(browserWindow);
      }
    });

    // Перехватываем новые окна (включая zoomus:// ссылки)
    browserWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('zoomus://')) {
        this.log('Blocking window open to native Zoom app:', url);
        this.forceStayOnWeb(browserWindow);
        return { action: 'deny' };
      }
      return { action: 'deny' };
    });

    browserWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        const headers = { ...details.requestHeaders };

        // Специальные заголовки для Zoom веб-клиента
        headers['Accept-Language'] = 'en-US,en;q=0.9';
        headers['Accept'] =
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
        headers['Accept-Encoding'] = 'gzip, deflate, br';

        // Chrome заголовки для Zoom
        headers['Sec-Ch-Ua'] =
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Platform'] = '"macOS"';
        headers['Sec-Ch-Ua-Platform-Version'] = '"13.0.0"';

        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-Site'] = 'none';
        headers['Sec-Fetch-User'] = '?1';
        headers['Upgrade-Insecure-Requests'] = '1';

        // Zoom-специфичные заголовки для принуждения к веб-версии
        headers['Cache-Control'] = 'no-cache';
        headers['Pragma'] = 'no-cache';
        headers['X-Zoom-Web-Client'] = 'true';
        headers['X-Client-Platform'] = 'web';
        headers['X-Client-Version'] = '5.17.0';

        // Удаляем подозрительные заголовки
        delete headers['X-DevTools-Emulate-Network-Conditions-Client-Id'];
        delete headers['X-Client-Data'];

        callback({ requestHeaders: headers });
      }
    );

    // Блокируем запросы к zoomus:// протоколу
    browserWindow.webContents.session.webRequest.onBeforeRequest(
      (details, callback) => {
        if (details.url.startsWith('zoomus://')) {
          this.log('Blocking request to native Zoom protocol:', details.url);
          callback({ cancel: true });
          this.forceStayOnWeb(browserWindow);
          return;
        }
        callback({});
      }
    );

    // Добавляем обработчик для автоматического перехода к веб-версии после загрузки
    browserWindow.webContents.on('did-finish-load', () => {
      this.log('Page loaded, attempting to force web version...');
      setTimeout(() => {
        this.forceStayOnWeb(browserWindow);
      }, 1000);
    });
  }

  /**
   * Принуждает браузер остаться на веб-версии
   */
  private forceStayOnWeb(browserWindow: BrowserWindow): void {
    browserWindow.webContents
      .executeJavaScript(
        `
      (function() {
        try {
          console.log('🔍 Starting web version detection...');

          // Простая функция поиска и клика
          function findAndClick() {
            // Поиск по самым распространенным селекторам
            const selectors = [
              'a[href*="wc/join"]',
              'a[href*="webclient"]',
              'button[data-testid*="web"]',
              'a[data-testid*="web"]',
              '.join-by-browser',
              '.web-client-link',
              'a:contains("Join from Your Browser")',
              'button:contains("Continue")',
              'a:contains("Continue")'
            ];

            for (let selector of selectors) {
              try {
                let element = document.querySelector(selector);
                if (element && element.click) {
                  console.log('✅ Found and clicking:', selector);
                  element.click();
                  return true;
                }
              } catch (e) {
                console.log('Error with selector:', selector, e);
              }
            }

            // Поиск по тексту (упрощенный)
            const buttons = document.querySelectorAll('button, a');
            for (let btn of buttons) {
              try {
                const text = (btn.textContent || '').toLowerCase();
                if (text.includes('continue') || text.includes('join') || text.includes('browser')) {
                  const href = btn.getAttribute('href') || '';
                  if (!href.startsWith('zoomus://')) {
                    console.log('✅ Found by text and clicking:', text);
                    btn.click();
                    return true;
                  }
                }
              } catch (e) {
                console.log('Error checking button text:', e);
              }
            }

            return false;
          }

          // Пробуем сразу
          if (findAndClick()) {
            return;
          }

          // Пробуем еще несколько раз с интервалом
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            console.log('🔄 Attempt', attempts);

            if (findAndClick() || attempts >= 10) {
              clearInterval(interval);
              if (attempts >= 10) {
                console.log('❌ Max attempts reached');
              }
            }
          }, 1000);

        } catch (error) {
          console.error('Error in forceStayOnWeb:', error);
        }
      })();
    `
      )
      .catch((error) => {
        this.log('Error executing web force script:', error);
      });
  }

  getMaskingScript(): string {
    return `
      (function() {
        try {
          console.log('🛡️ Initializing Zoom web protection...');

          // Блокируем zoomus:// протокол
          const originalOpen = window.open;
          window.open = function(url, target, features) {
            if (url && url.toString().startsWith('zoomus://')) {
              console.log('🚫 Blocked window.open to zoomus://', url);
              return null;
            }
            return originalOpen.call(this, url, target, features);
          };

          const originalAssign = location.assign;
          location.assign = function(url) {
            if (url.toString().startsWith('zoomus://')) {
              console.log('🚫 Blocked location.assign to zoomus://', url);
              return;
            }
            return originalAssign.call(this, url);
          };

          const originalReplace = location.replace;
          location.replace = function(url) {
            if (url.toString().startsWith('zoomus://')) {
              console.log('🚫 Blocked location.replace to zoomus://', url);
              return;
            }
            return originalReplace.call(this, url);
          };

          // Базовая маскировка
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true
          });

          Object.defineProperty(navigator, 'plugins', {
            get: () => ({
              length: 3,
              0: { name: 'Chrome PDF Plugin' },
              1: { name: 'Chromium PDF Plugin' },
              2: { name: 'Microsoft Edge PDF Plugin' }
            }),
            configurable: true
          });

          // Удаляем Node.js следы
          const nodeObjects = ['process', 'require', 'module', 'global', 'Buffer'];
          nodeObjects.forEach(obj => {
            try {
              if (window[obj]) {
                delete window[obj];
              }
            } catch (e) {
              // Игнорируем ошибки
            }
          });

          console.log('✅ Zoom web protection ready');

        } catch (error) {
          console.error('Error in masking script:', error);
        }
      })();
    `;
  }

  getDelays(): VideoCallDelays {
    return {
      showDelay: 1500, // Больше времени для обработки всех редиректов
      loadDelay: 700, // Дополнительная задержка для полной загрузки
    };
  }
}
