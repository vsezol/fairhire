import { BrowserWindow } from 'electron';

export interface VideoCallDelays {
  showDelay: number;
  loadDelay: number;
}

export interface VideoCallConfig {
  userAgent: string;
  sessionPartition: string;
  windowConfig: Partial<Electron.BrowserWindowConstructorOptions>;
}

export abstract class VideoCallStrategy {
  abstract name: string;

  /**
   * Проверяет, подходит ли данная стратегия для URL
   */
  abstract canHandle(url: string): boolean;

  /**
   * Предварительная подготовка сессии
   */
  abstract warmupSession(): Promise<void>;

  /**
   * Получение конфигурации для окна браузера
   */
  abstract getWindowConfig(): VideoCallConfig;

  /**
   * Настройка заголовков HTTP запросов
   */
  abstract setupHeaders(browserWindow: BrowserWindow): void;

  /**
   * Получение скрипта маскировки браузера
   */
  abstract getMaskingScript(): string;

  /**
   * Получение задержек для показа окна
   */
  abstract getDelays(): VideoCallDelays;

  /**
   * Логирование для отладки
   */
  protected log(message: string, ...args: any[]): void {
    console.log(`[${this.name}]:`, message, ...args);
  }
}
