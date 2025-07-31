import { join } from 'path';
import { StorageAdapter } from './storage-adapter.interface.js';
import {
  JsonStorageAdapter,
  JsonStorageConfig,
} from '../../shared/json/index.js';
import {
  SupabaseStorageAdapter,
  SupabaseStorageConfig,
} from '../../shared/db/index.js';
import { getSupabaseConfig, validateSupabaseConfig } from './config.js';

// Фабричная функция для JSON адаптера
export function createJsonAdapter(outputPath?: string): StorageAdapter {
  const config: JsonStorageConfig = {
    outputPath: outputPath || join(process.cwd(), 'activity-session.json'),
  };

  return new JsonStorageAdapter(config);
}

// Фабричная функция для Supabase адаптера
export function createSupabaseAdapter(
  config?: Partial<SupabaseStorageConfig>
): StorageAdapter {
  const defaultConfig = getSupabaseConfig();
  const finalConfig: SupabaseStorageConfig = {
    ...defaultConfig,
    ...config,
  };

  if (!validateSupabaseConfig(finalConfig)) {
    throw new Error('Invalid Supabase configuration');
  }

  return new SupabaseStorageAdapter(finalConfig);
}

// Умный адаптер с fallback при инициализации
export async function createSmartAutoAdapter(
  options: {
    jsonOutputPath?: string;
    supabaseConfig?: Partial<SupabaseStorageConfig>;
    preferSupabase?: boolean;
  } = {}
): Promise<StorageAdapter> {
  const { jsonOutputPath, supabaseConfig, preferSupabase = true } = options;

  if (preferSupabase) {
    try {
      const supabaseAdapter = createSupabaseAdapter(supabaseConfig);
      // Пробуем инициализировать для проверки подключения
      await supabaseAdapter.initialize();
      console.log('✅ Supabase adapter initialized successfully');
      return supabaseAdapter;
    } catch (error) {
      console.warn(
        '⚠️ Failed to initialize Supabase adapter, falling back to JSON:',
        error
      );
      const jsonAdapter = createJsonAdapter(jsonOutputPath);
      await jsonAdapter.initialize();
      return jsonAdapter;
    }
  } else {
    const jsonAdapter = createJsonAdapter(jsonOutputPath);
    await jsonAdapter.initialize();
    return jsonAdapter;
  }
}

// Enum для типов адаптеров
export enum StorageType {
  JSON = 'json',
  SUPABASE = 'supabase',
}

// Фабричная функция с выбором типа
export function createStorageAdapter(
  type: StorageType,
  config?: JsonStorageConfig | SupabaseStorageConfig
): StorageAdapter {
  switch (type) {
    case StorageType.JSON:
      return new JsonStorageAdapter(config as JsonStorageConfig);
    case StorageType.SUPABASE:
      return new SupabaseStorageAdapter(config as SupabaseStorageConfig);
    default:
      throw new Error(`Unsupported storage type: ${type}`);
  }
}
