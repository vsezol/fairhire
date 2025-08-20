import { ActivityEvent, ActivitySession } from '../types.js';

// Интерфейс для адаптеров сохранения
export interface StorageAdapter {
  // Инициализация адаптера
  initialize(): Promise<void>;

  // Создание новой сессии
  createSession(session: ActivitySession): Promise<void>;

  // Обновление сессии
  updateSession(session: ActivitySession): Promise<void>;

  // Сохранение события активности
  saveEvent(sessionId: string, event: ActivityEvent): Promise<void>;

  // Завершение работы адаптера
  destroy(): Promise<void>;

  // Проверка готовности адаптера
  isReady(): boolean;
}

// Базовый класс для адаптеров
export abstract class BaseStorageAdapter implements StorageAdapter {
  protected initialized = false;

  abstract initialize(): Promise<void>;
  abstract createSession(session: ActivitySession): Promise<void>;
  abstract updateSession(session: ActivitySession): Promise<void>;
  abstract saveEvent(sessionId: string, event: ActivityEvent): Promise<void>;

  abstract destroy(): Promise<void>;

  public isReady(): boolean {
    return this.initialized;
  }
}
