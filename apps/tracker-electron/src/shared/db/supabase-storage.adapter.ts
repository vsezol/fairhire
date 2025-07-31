import { SupabaseClient } from '@supabase/supabase-js';
import { ActivityEvent, ActivitySession } from '../../activity-tracker.js';
import { BaseStorageAdapter } from '../../features/activity-tracking/storage-adapter.interface.js';
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
    this.BATCH_TIMEOUT = config.batchTimeout || 5000; // 5 секунд
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
      const { error } = await this.client
        .from('sessions')
        .update({
          end_time: session.endTime,
          total_events: session.totalEvents,
          duration: session.endTime
            ? session.endTime - session.startTime
            : undefined,
          updated_at: new Date().toISOString(),
        })
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

  public async getSessionWithEvents(sessionId: string): Promise<{
    session: ActivitySession | null;
    events: ActivityEvent[];
  }> {
    if (!this.initialized || !this.client) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      // Получаем сессию
      const { data: sessionData, error: sessionError } = await this.client
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          // Сессия не найдена
          return { session: null, events: [] };
        }
        throw new Error(sessionError.message);
      }

      // Получаем события
      const { data: eventsData, error: eventsError } = await this.client
        .from('user_activities')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (eventsError) {
        throw new Error(eventsError.message);
      }

      // Преобразуем данные в формат ActivitySession и ActivityEvent
      const session: ActivitySession = {
        sessionId: sessionData.session_id,
        startTime: sessionData.start_time,
        endTime: sessionData.end_time || undefined,
        callUrl: sessionData.call_url || undefined,
        totalEvents: sessionData.total_events,
      };

      const events: ActivityEvent[] = (eventsData || []).map((dbEvent) => ({
        type: dbEvent.event_type as ActivityEvent['type'],
        timestamp: dbEvent.timestamp,
        data: dbEvent.event_data,
      }));

      return { session, events };
    } catch (error) {
      console.error('❌ Supabase: Failed to get session with events:', error);
      throw error;
    }
  }

  public async getSessionsByCallUrl(
    callUrl: string
  ): Promise<ActivitySession[]> {
    if (!this.initialized || !this.client) {
      throw new Error('Storage adapter not initialized');
    }

    try {
      const { data, error } = await this.client
        .from('sessions')
        .select('*')
        .eq('call_url', callUrl)
        .order('start_time', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []).map((dbSession) => ({
        sessionId: dbSession.session_id,
        startTime: dbSession.start_time,
        endTime: dbSession.end_time || undefined,
        callUrl: dbSession.call_url || undefined,
        totalEvents: dbSession.total_events,
      }));
    } catch (error) {
      console.error('❌ Supabase: Failed to get sessions by callUrl:', error);
      throw error;
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
      return; // Таймер уже установлен
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

      console.log(`✅ Supabase: Inserted ${eventsToInsert.length} events`);
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
