import { promises as fs } from 'fs';
import {
  ActivityEvent,
  ActivitySession,
} from '../../features/activity-tracking/types.js';
import { APP_VERSION } from '../../version.js';
import { BaseStorageAdapter } from '../../features/activity-tracking/index.js';

export interface JsonStorageConfig {
  outputPath: string;
}

export class JsonStorageAdapter extends BaseStorageAdapter {
  private outputFile: string;
  private eventFile: string;
  private sessionsIndex: Map<string, ActivitySession> = new Map();
  private eventsBySession: Map<string, ActivityEvent[]> = new Map();
  private sessionsByCallUrl: Map<string, Set<string>> = new Map();

  constructor(private config: JsonStorageConfig) {
    super();
    this.outputFile = this.config.outputPath;
    this.eventFile = this.outputFile.replace('.json', '.jsonl');
  }

  public async initialize(): Promise<void> {
    try {
      // Загружаем существующие сессии если есть
      await this.loadExistingSessions();
      // Загружаем существующие события если есть
      await this.loadExistingEvents();

      this.initialized = true;
      console.log('✅ JSON storage adapter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize JSON storage adapter:', error);
      throw error;
    }
  }

  public async createSession(session: ActivitySession): Promise<void> {
    if (!this.initialized) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      // Сохраняем в индексе
      this.sessionsIndex.set(session.sessionId, { ...session });
      this.eventsBySession.set(session.sessionId, []);

      // Индексируем по callUrl если есть
      if (session.callUrl) {
        if (!this.sessionsByCallUrl.has(session.callUrl)) {
          this.sessionsByCallUrl.set(session.callUrl, new Set());
        }
        this.sessionsByCallUrl.get(session.callUrl)!.add(session.sessionId);
      }

      // Сохраняем в файл
      await this.saveSessionToFile(session);
      console.log(`✅ JSON: Session created: ${session.sessionId}`);
    } catch (error) {
      console.error('❌ JSON: Failed to create session:', error);
      throw error;
    }
  }

  public async updateSession(session: ActivitySession): Promise<void> {
    if (!this.initialized) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      // Обновляем в индексе
      const existingSession = this.sessionsIndex.get(session.sessionId);
      if (!existingSession) {
        throw new Error(`Session ${session.sessionId} not found`);
      }

      this.sessionsIndex.set(session.sessionId, { ...session });

      // Обновляем индекс по callUrl если изменился
      if (existingSession.callUrl !== session.callUrl) {
        // Удаляем из старого индекса
        if (existingSession.callUrl) {
          const oldSet = this.sessionsByCallUrl.get(existingSession.callUrl);
          if (oldSet) {
            oldSet.delete(session.sessionId);
            if (oldSet.size === 0) {
              this.sessionsByCallUrl.delete(existingSession.callUrl);
            }
          }
        }

        // Добавляем в новый индекс
        if (session.callUrl) {
          if (!this.sessionsByCallUrl.has(session.callUrl)) {
            this.sessionsByCallUrl.set(session.callUrl, new Set());
          }
          this.sessionsByCallUrl.get(session.callUrl)!.add(session.sessionId);
        }
      }

      // Сохраняем в файл
      await this.saveSessionToFile(session);
      console.log(`✅ JSON: Session updated: ${session.sessionId}`);
    } catch (error) {
      console.error('❌ JSON: Failed to update session:', error);
      throw error;
    }
  }

  public async saveEvent(
    sessionId: string,
    event: ActivityEvent
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      // Добавляем в индекс событий
      if (!this.eventsBySession.has(sessionId)) {
        this.eventsBySession.set(sessionId, []);
      }
      this.eventsBySession.get(sessionId)!.push(event);

      // Обновляем счетчик событий в сессии
      const session = this.sessionsIndex.get(sessionId);
      if (session) {
        session.totalEvents++;
        this.sessionsIndex.set(sessionId, session);
      }

      // Сохраняем событие в файл
      await this.saveEventToFile(sessionId, event);
    } catch (error) {
      console.error('❌ JSON: Failed to save event:', error);
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    // Сохраняем финальное состояние всех сессий
    for (const session of this.sessionsIndex.values()) {
      await this.saveSessionToFile(session);
    }

    console.log('✅ JSON storage adapter destroyed');
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.outputFile, 'utf-8');
      const sessions = JSON.parse(data);

      if (Array.isArray(sessions)) {
        // Если это массив сессий
        for (const session of sessions) {
          this.sessionsIndex.set(session.sessionId, session);
          if (session.callUrl) {
            if (!this.sessionsByCallUrl.has(session.callUrl)) {
              this.sessionsByCallUrl.set(session.callUrl, new Set());
            }
            this.sessionsByCallUrl.get(session.callUrl)!.add(session.sessionId);
          }
        }
      } else if (sessions.sessionId) {
        // Если это одна сессия
        this.sessionsIndex.set(sessions.sessionId, sessions);
        if (sessions.callUrl) {
          if (!this.sessionsByCallUrl.has(sessions.callUrl)) {
            this.sessionsByCallUrl.set(sessions.callUrl, new Set());
          }
          this.sessionsByCallUrl.get(sessions.callUrl)!.add(sessions.sessionId);
        }
      }
    } catch (error) {
      // Файл не существует или поврежден - это нормально для первого запуска
      console.log('📝 No existing sessions file found, starting fresh');
    }
  }

  private async loadExistingEvents(): Promise<void> {
    try {
      const data = await fs.readFile(this.eventFile, 'utf-8');
      const lines = data.trim().split('\n');

      for (const line of lines) {
        if (line.trim()) {
          const logEntry = JSON.parse(line);
          const sessionId = logEntry.sessionId;
          const event = logEntry.event;

          if (!this.eventsBySession.has(sessionId)) {
            this.eventsBySession.set(sessionId, []);
          }
          this.eventsBySession.get(sessionId)!.push(event);
        }
      }
    } catch (error) {
      // Файл не существует - это нормально для первого запуска
      console.log('📝 No existing events file found, starting fresh');
    }
  }

  private async saveSessionToFile(session: ActivitySession): Promise<void> {
    try {
      const sessionData = {
        ...session,
        savedAt: new Date().toISOString(),
        duration: session.endTime ? session.endTime - session.startTime : 0,
        platform: process.platform,
        appVersion: APP_VERSION,
      };

      await fs.writeFile(
        this.outputFile,
        JSON.stringify(sessionData, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('❌ Failed to save session to file:', error);
      throw error;
    }
  }

  private async saveEventToFile(
    sessionId: string,
    event: ActivityEvent
  ): Promise<void> {
    try {
      const logEntry = {
        sessionId,
        event,
        timestamp: new Date().toISOString(),
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.eventFile, logLine, 'utf-8');
    } catch (error) {
      console.error('❌ Failed to save event to file:', error);
      throw error;
    }
  }
}
