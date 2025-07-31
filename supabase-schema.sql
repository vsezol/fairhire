-- Создание таблицы сессий
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT,
  call_url TEXT,
  total_events INTEGER DEFAULT 0,
  duration BIGINT,
  platform VARCHAR(50) NOT NULL,
  app_version VARCHAR(50) NOT NULL,
  -- Новые поля для геометрии
  screen_width INTEGER,
  screen_height INTEGER,
  screen_scale_factor REAL,
  window_x INTEGER,
  window_y INTEGER,
  window_width INTEGER,
  window_height INTEGER,
  window_is_visible BOOLEAN DEFAULT TRUE,
  window_is_focused BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы активностей пользователя
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  timestamp BIGINT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_call_url ON sessions(call_url);
CREATE INDEX IF NOT EXISTS idx_user_activities_session_id ON user_activities(session_id);


-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at в таблице sessions
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Политики безопасности (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Базовые политики (можно настроить по необходимости)
CREATE POLICY "Allow all operations on sessions" ON sessions
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on user_activities" ON user_activities
  FOR ALL USING (true);
