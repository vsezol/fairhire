import { BrowserWindow } from 'electron';

export class ScreenshotProtectionService {
  private readonly platform = process.platform;
  private protectedWindows = new Set<BrowserWindow>();

  public protectWindow(window: BrowserWindow): void {
    if (this.protectedWindows.has(window)) {
      return;
    }

    this.applyNativeProtection(window);
    // this.injectContentProtection(window);
    this.protectedWindows.add(window);

    window.once('closed', () => {
      this.protectedWindows.delete(window);
    });
  }

  private applyNativeProtection(window: BrowserWindow): void {
    try {
      if (
        window.setContentProtection &&
        typeof window.setContentProtection === 'function'
      ) {
        window.setContentProtection(true);
        console.log('✅ Native screenshot protection enabled');
      } else {
        console.log(
          '⚠️ Native content protection not available on this platform'
        );
      }

      if (this.platform === 'darwin') {
        this.applyMacOSProtection(window);
      }

      if (this.platform === 'win32') {
        this.applyWindowsProtection(window);
      }
    } catch (error) {
      console.warn('⚠️ Some native protection features failed:', error);
    }
  }

  private applyMacOSProtection(window: BrowserWindow): void {
    try {
      // window.setVibrancy('ultra-dark'); // TODO

      // Убираем тень (может помочь против некоторых инструментов)
      window.setHasShadow(false);

      // Минимальная прозрачность
      window.setOpacity(0.99);

      // Скрываем от системных API
      window.setVisibleOnAllWorkspaces(false);

      console.log('✅ macOS screenshot protection applied');
    } catch (error) {
      console.warn('⚠️ macOS protection failed:', error);
    }
  }

  private applyWindowsProtection(window: BrowserWindow): void {
    try {
      // Отключаем фоновое ограничение (может помочь с захватом)
      window.webContents.setBackgroundThrottling(false);

      console.log('✅ Windows screenshot protection applied');
    } catch (error) {
      console.warn('⚠️ Windows protection failed:', error);
    }
  }

  // private injectContentProtection(window: BrowserWindow): void {
  //   window.webContents.once('dom-ready', () => {
  //     this.injectProtectionScript(window);
  //   });

  //   window.webContents.on('did-finish-load', () => {
  //     this.injectProtectionScript(window);
  //   });
  // }

  // private injectProtectionScript(window: BrowserWindow): void {
  //   if (window.isDestroyed()) return;

  //   const protectionScript = `
  //     const existingStyles = document.querySelectorAll('style[data-screenshot-protection]');
  //     existingStyles.forEach(style => style.remove());

  //     // Создаем стили для защиты от скриншотов
  //     const protectionStyle = document.createElement('style');
  //     protectionStyle.setAttribute('data-screenshot-protection', 'true');
  //     protectionStyle.textContent = \`
  //       /* Защита от скриншотов при записи экрана */
  //       html[data-recording="true"],
  //       body[data-recording="true"] {
  //         background: #000 !important;
  //       }

  //       html[data-recording="true"] *,
  //       body[data-recording="true"] * {
  //         visibility: hidden !important;
  //         opacity: 0 !important;
  //         background: #000 !important;
  //         color: transparent !important;
  //       }

  //       html[data-recording="true"]::before {
  //         content: "🚫 SCREENSHOT BLOCKED" !important;
  //         position: fixed !important;
  //         top: 50% !important;
  //         left: 50% !important;
  //         transform: translate(-50%, -50%) !important;
  //         color: #fff !important;
  //         font-size: 48px !important;
  //         z-index: 2147483647 !important;
  //         display: block !important;
  //         visibility: visible !important;
  //         opacity: 1 !important;
  //         font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
  //         text-align: center !important;
  //       }

  //       /* Защита при печати */
  //       @media print {
  //         html, body, * {
  //           background: #000 !important;
  //           color: transparent !important;
  //           visibility: hidden !important;
  //         }
  //       }
  //     \`;

  //     document.head.appendChild(protectionStyle);

  //     // Детекция записи экрана
  //     if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
  //       const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

  //       navigator.mediaDevices.getDisplayMedia = function(...args) {
  //         console.log('🚨 SCREEN RECORDING DETECTED - ACTIVATING PROTECTION!');

  //         // Активируем защиту
  //         document.documentElement.setAttribute('data-recording', 'true');
  //         document.body.setAttribute('data-recording', 'true');

  //         // Принудительно черный фон
  //         document.body.style.background = '#000';
  //         document.documentElement.style.background = '#000';

  //         return originalGetDisplayMedia.apply(this, args);
  //       };
  //     }

  //     // Детекция скрытия окна (возможная попытка скриншота)
  //     document.addEventListener('visibilitychange', function() {
  //       if (document.hidden) {
  //         console.log('🚨 Window hidden - potential screenshot attempt');
  //         document.documentElement.setAttribute('data-recording', 'true');
  //         document.body.setAttribute('data-recording', 'true');
  //       } else {
  //         // Через секунду убираем защиту когда окно снова видимо
  //         setTimeout(() => {
  //           document.documentElement.removeAttribute('data-recording');
  //           document.body.removeAttribute('data-recording');
  //         }, 1000);
  //       }
  //     });

  //     console.log('✅ Screenshot protection active');
  //   `;

  //   window.webContents.executeJavaScript(protectionScript).catch((error) => {
  //     console.warn('Failed to inject screenshot protection:', error);
  //   });
  // }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up screenshot protection...');
    this.protectedWindows.clear();
  }
}

export const screenshotProtectionService = new ScreenshotProtectionService();
