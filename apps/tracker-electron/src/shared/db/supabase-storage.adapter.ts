import { SupabaseClient } from '@supabase/supabase-js';
import {
  ActivityEvent,
  ActivitySession,
} from '../../features/activity-tracking/types.js';
import { BaseStorageAdapter } from '../../features/activity-tracking/index.js';
import { DatabaseSession, DatabaseUserActivity } from './supabase.types.js';
import { initializeSupabaseClient, SupabaseConfig } from './supabase.client.js';
import { app } from 'electron';

export interface SupabaseStorageConfig extends SupabaseConfig {
  batchSize?: number;
  batchTimeout?: number;
}

export class SupabaseStorageAdapter extends BaseStorageAdapter {
  private client: SupabaseClient | null = null;
  private batchBuffer: { sessionId: string; event: ActivityEvent }[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE: number;
  private readonly BATCH_TIMEOUT: number;

  constructor(private config: SupabaseStorageConfig) {
    super();
    this.BATCH_SIZE = config.batchSize || 50;
    this.BATCH_TIMEOUT = config.batchTimeout || 3000;
  }

  public async initialize(): Promise<void> {
    try {
      this.client = initializeSupabaseClient({
        url: this.config.url,
        anonKey: this.config.anonKey,
      });

      // Проверяем соединение
      const { error } = await this.client
        .from('sessions')
        .select('id')
        .limit(1);
      if (error && !error.message.includes('0 rows')) {
        throw new Error(`Supabase connection failed: ${error.message}`);
      }

      this.initialized = true;
      console.log('✅ Supabase storage adapter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase storage adapter:', error);
      throw error;
    }
  }

  public async createSession(session: ActivitySession): Promise<void> {
    if (!this.initialized || !this.client) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      const sessionData: Omit<
        DatabaseSession,
        'id' | 'created_at' | 'updated_at'
      > = {
        session_id: session.sessionId,
        start_time: session.startTime,
        call_url: session.callUrl,
        total_events: session.totalEvents,
        platform: process.platform,
        app_version: app.getVersion(),
        // Добавляем геометрию
        screen_width: session.geometry?.screen.width,
        screen_height: session.geometry?.screen.height,
        screen_scale_factor: session.geometry?.screen.scaleFactor,
        window_x: session.geometry?.window.x,
        window_y: session.geometry?.window.y,
        window_width: session.geometry?.window.width,
        window_height: session.geometry?.window.height,
        window_is_visible: session.geometry?.window.isVisible,
        window_is_focused: session.geometry?.window.isFocused,
        display_count: session.geometry?.displayCount || 0,
        processes: session.processes.map((process) => ({
          name: process.name,
          isSuspicious: process.isSuspicious,
          isApplication: process.isApplication,
        })),
        is_virtual: session.isVirtual || false,
        virtual_host: session.virtualHost,
        system_resources: session.systemResources,
      };

      const { error } = await this.client.from('sessions').insert(sessionData);

      if (error) {
        console.error('❌ Supabase: Failed to create session:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Supabase: Session created: ${session.sessionId}`);
    } catch (error) {
      console.error('❌ Supabase: Failed to create session:', error);
      throw error;
    }
  }

  public async updateSession(session: ActivitySession): Promise<void> {
    if (!this.initialized || !this.client) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      const updateData: Partial<DatabaseSession> = {
        end_time: session.endTime,
        total_events: session.totalEvents,
        duration: session.endTime
          ? session.endTime - session.startTime
          : undefined,
        updated_at: new Date().toISOString(),
        screen_width: session.geometry?.screen.width,
        screen_height: session.geometry?.screen.height,
        screen_scale_factor: session.geometry?.screen.scaleFactor,
        window_x: session.geometry?.window.x,
        window_y: session.geometry?.window.y,
        window_width: session.geometry?.window.width,
        window_height: session.geometry?.window.height,
        window_is_visible: session.geometry?.window.isVisible,
        window_is_focused: session.geometry?.window.isFocused,
        processes: session.processes.map((process) => ({
          name: process.name,
          isSuspicious: process.isSuspicious,
          isApplication: process.isApplication,
        })),
        system_resources: session.systemResources,
      };

      const { error } = await this.client
        .from('sessions')
        .update(updateData)
        .eq('session_id', session.sessionId);

      if (error) {
        console.error('❌ Supabase: Failed to update session:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Supabase: Session updated: ${session.sessionId}`);
    } catch (error) {
      console.error('❌ Supabase: Failed to update session:', error);
      throw error;
    }
  }

  public async saveEvent(
    sessionId: string,
    event: ActivityEvent
  ): Promise<void> {
    if (!this.initialized || !this.client) {
      throw new Error('Storage adapter not initialized');
    }

    // Добавляем событие в буфер для батчевой отправки
    this.batchBuffer.push({ sessionId, event });

    // Если буфер заполнен, отправляем немедленно
    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    } else {
      // Иначе устанавливаем таймер для отправки
      this.scheduleBatchFlush();
    }
  }

  public async destroy(): Promise<void> {
    // Отправляем оставшиеся события
    if (this.batchBuffer.length > 0) {
      console.log('🔄 Flushing remaining events before shutdown...');
      await this.flushBatch();
    }

    // Очищаем таймер
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    console.log('✅ Supabase storage adapter destroyed');
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimeout) {
      return;
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatch().catch((error) => {
        console.error('❌ Error during scheduled batch flush:', error);
      });
    }, this.BATCH_TIMEOUT);
  }

  private async flushBatch(): Promise<void> {
    if (!this.client || this.batchBuffer.length === 0) {
      return;
    }

    // Очищаем таймер
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const eventsToInsert = [...this.batchBuffer];
    this.batchBuffer = [];

    try {
      const activityData: Omit<DatabaseUserActivity, 'id' | 'created_at'>[] =
        eventsToInsert.map((item) => ({
          session_id: item.sessionId,
          event_type: item.event.type,
          timestamp: item.event.timestamp,
          event_data: item.event.data,
        }));

      const { error } = await this.client
        .from('user_activities')
        .insert(activityData);

      if (error) {
        console.error('❌ Supabase: Failed to insert events batch:', error);

        // Возвращаем события обратно в буфер для повторной попытки
        this.batchBuffer.unshift(...eventsToInsert);
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('❌ Supabase: Unexpected error during batch flush:', error);

      // Возвращаем события обратно в буфер
      this.batchBuffer.unshift(...eventsToInsert);
      throw error;
    }
  }

  public getPendingEventsCount(): number {
    return this.batchBuffer.length;
  }
}
