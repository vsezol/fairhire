import { BrowserWindow } from 'electron';

export class ScreenshotProtectionService {
  private readonly platform = process.platform;
  private protectedWindows = new Set<BrowserWindow>();

  public protectWindow(window: BrowserWindow): void {
    if (this.protectedWindows.has(window)) {
      return;
    }

    this.applyNativeProtection(window);
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
      window.setHasShadow(false);
      window.setOpacity(0.99);
      window.setVisibleOnAllWorkspaces(false);

      console.log('✅ macOS screenshot protection applied');
    } catch (error) {
      console.warn('⚠️ macOS protection failed:', error);
    }
  }

  private applyWindowsProtection(window: BrowserWindow): void {
    try {
      window.webContents.setBackgroundThrottling(false);

      console.log('✅ Windows screenshot protection applied');
    } catch (error) {
      console.warn('⚠️ Windows protection failed:', error);
    }
  }

  public cleanup(): void {
    console.log('🧹 Cleaning up screenshot protection...');
    this.protectedWindows.clear();
  }
}

export const screenshotProtectionService = new ScreenshotProtectionService();
