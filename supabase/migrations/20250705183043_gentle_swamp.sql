/*
  # Создание таблиц для результатов парсинга

  1. Новые таблицы
    - `parsing_sessions` - сессии парсинга
      - `id` (uuid, primary key)
      - `url` (text) - целевой URL
      - `mode` (text) - режим парсинга
      - `status` (text) - статус выполнения
      - `proxy_enabled` (boolean) - использовался ли прокси
      - `proxy_url` (text) - URL прокси
      - `results_count` (integer) - количество результатов
      - `created_at` (timestamp)
      - `completed_at` (timestamp)
      - `user_id` (uuid) - ID пользователя

    - `parsing_results` - результаты парсинга
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key)
      - `type` (text) - тип результата (email, link, data, html)
      - `title` (text) - заголовок/описание
      - `content` (text) - содержимое
      - `source` (text) - источник данных
      - `created_at` (timestamp)

  2. Безопасность
    - Включить RLS для всех таблиц
    - Политики для аутентифицированных пользователей
*/

-- Создание таблицы сессий парсинга
CREATE TABLE IF NOT EXISTS parsing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('email', 'links', 'data', 'html')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
  proxy_enabled boolean DEFAULT false,
  proxy_url text,
  results_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Создание таблицы результатов парсинга
CREATE TABLE IF NOT EXISTS parsing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES parsing_sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email', 'link', 'data', 'html')),
  title text NOT NULL,
  content text NOT NULL,
  source text,
  created_at timestamptz DEFAULT now()
);

-- Включение RLS
ALTER TABLE parsing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsing_results ENABLE ROW LEVEL SECURITY;

-- Политики для parsing_sessions
CREATE POLICY "Пользователи могут просматривать свои сессии"
  ON parsing_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Пользователи могут создавать свои сессии"
  ON parsing_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Пользователи могут обновлять свои сессии"
  ON parsing_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Пользователи могут удалять свои сессии"
  ON parsing_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Политики для parsing_results
CREATE POLICY "Пользователи могут просматривать результаты своих сессий"
  ON parsing_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parsing_sessions 
      WHERE parsing_sessions.id = parsing_results.session_id 
      AND parsing_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Пользователи могут создавать результаты для своих сессий"
  ON parsing_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM parsing_sessions 
      WHERE parsing_sessions.id = parsing_results.session_id 
      AND parsing_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Пользователи могут удалять результаты своих сессий"
  ON parsing_results
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parsing_sessions 
      WHERE parsing_sessions.id = parsing_results.session_id 
      AND parsing_sessions.user_id = auth.uid()
    )
  );

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_parsing_sessions_user_id ON parsing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_parsing_sessions_created_at ON parsing_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parsing_results_session_id ON parsing_results(session_id);
CREATE INDEX IF NOT EXISTS idx_parsing_results_type ON parsing_results(type);