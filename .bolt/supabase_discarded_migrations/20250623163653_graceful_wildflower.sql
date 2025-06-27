/*
  # Sistema de Transmissão com Wowza

  1. Novas Tabelas
    - `streaming_platforms` - Plataformas de streaming disponíveis (YouTube, Facebook, etc.)
    - `user_streaming_platforms` - Configurações de plataformas por usuário
    - `transmissions` - Transmissões ativas/históricas
    - `transmission_platforms` - Relação entre transmissões e plataformas

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para usuários autenticados gerenciarem apenas seus dados

  3. Funcionalidades
    - Suporte a múltiplas plataformas simultâneas
    - Controle de status de transmissão
    - Histórico de transmissões
    - Configurações personalizadas por usuário
*/

-- Plataformas de streaming disponíveis
CREATE TABLE IF NOT EXISTS streaming_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL,
  icone text,
  rtmp_base_url text,
  requer_stream_key boolean DEFAULT true,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE streaming_platforms ENABLE ROW LEVEL SECURITY;

-- Política para todos verem plataformas ativas
CREATE POLICY "Todos podem ver plataformas ativas"
  ON streaming_platforms
  FOR SELECT
  TO public
  USING (ativo = true);

-- Configurações de plataformas por usuário
CREATE TABLE IF NOT EXISTS user_streaming_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_platform uuid NOT NULL REFERENCES streaming_platforms(id) ON DELETE CASCADE,
  stream_key text NOT NULL,
  rtmp_url text,
  titulo_padrao text,
  descricao_padrao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(id_user, id_platform)
);

ALTER TABLE user_streaming_platforms ENABLE ROW LEVEL SECURITY;

-- Política para usuários gerenciarem suas plataformas
CREATE POLICY "Usuários podem gerenciar suas plataformas"
  ON user_streaming_platforms
  FOR ALL
  TO authenticated
  USING (auth.uid() = id_user)
  WITH CHECK (auth.uid() = id_user);

-- Transmissões
CREATE TABLE IF NOT EXISTS transmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_server uuid REFERENCES servers(id) ON DELETE SET NULL,
  id_playlist integer REFERENCES playlists(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'preparando' CHECK (status IN ('preparando', 'ativa', 'pausada', 'finalizada', 'erro')),
  tipo text NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'agendada', 'playlist')),
  data_inicio timestamptz,
  data_fim timestamptz,
  wowza_application_name text,
  wowza_stream_name text,
  configuracoes jsonb DEFAULT '{}',
  erro_detalhes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transmissions ENABLE ROW LEVEL SECURITY;

-- Política para usuários gerenciarem suas transmissões
CREATE POLICY "Usuários podem gerenciar suas transmissões"
  ON transmissions
  FOR ALL
  TO authenticated
  USING (auth.uid() = id_user)
  WITH CHECK (auth.uid() = id_user);

-- Relação entre transmissões e plataformas
CREATE TABLE IF NOT EXISTS transmission_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transmission uuid NOT NULL REFERENCES transmissions(id) ON DELETE CASCADE,
  id_user_platform uuid NOT NULL REFERENCES user_streaming_platforms(id) ON DELETE CASCADE,
  status text DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'erro', 'finalizada')),
  wowza_publisher_name text,
  erro_detalhes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transmission_platforms ENABLE ROW LEVEL SECURITY;

-- Políticas para transmission_platforms
CREATE POLICY "Usuários podem ver plataformas de suas transmissões"
  ON transmission_platforms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transmissions t 
      WHERE t.id = transmission_platforms.id_transmission 
      AND t.id_user = auth.uid()
    )
  );

CREATE POLICY "Usuários podem inserir plataformas em suas transmissões"
  ON transmission_platforms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transmissions t 
      WHERE t.id = transmission_platforms.id_transmission 
      AND t.id_user = auth.uid()
    )
  );

-- Inserir plataformas padrão
INSERT INTO streaming_platforms (nome, codigo, icone, rtmp_base_url, requer_stream_key) VALUES
  ('YouTube', 'youtube', 'youtube', 'rtmp://a.rtmp.youtube.com/live2', true),
  ('Facebook', 'facebook', 'facebook', 'rtmps://live-api-s.facebook.com:443/rtmp', true),
  ('Instagram', 'instagram', 'instagram', 'rtmps://live-api-s.facebook.com:443/rtmp', true),
  ('Twitch', 'twitch', 'twitch', 'rtmp://live.twitch.tv/live', true),
  ('TikTok', 'tiktok', 'video', 'rtmp://ingest.live.tiktok.com/live', true),
  ('Vimeo', 'vimeo', 'video', 'rtmp://rtmp-global.cloud.vimeo.com/live', true),
  ('RTMP Personalizado', 'custom', 'activity', '', false)
ON CONFLICT (codigo) DO NOTHING;