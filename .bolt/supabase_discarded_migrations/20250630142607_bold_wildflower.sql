/*
  # Criação das tabelas para sistema de espectadores

  1. Novas Tabelas
    - `espectadores`
      - `id` (uuid, primary key)
      - `id_user` (uuid, foreign key para users)
      - `ip_hash` (text, hash do IP para privacidade)
      - `user_agent` (text, informações do navegador)
      - `pais` (text, país do espectador)
      - `cidade` (text, cidade do espectador)
      - `latitude` (numeric, coordenada geográfica)
      - `longitude` (numeric, coordenada geográfica)
      - `dispositivo` (text, tipo de dispositivo)
      - `navegador` (text, navegador utilizado)
      - `resolucao` (text, resolução da tela)
      - `tempo_visualizacao` (integer, tempo em segundos)
      - `ativo` (boolean, se está assistindo atualmente)
      - `referrer` (text, página de origem)
      - `created_at` (timestamp, quando conectou)
      - `ultima_atividade` (timestamp, última atividade)
      - `desconectado_em` (timestamp, quando desconectou)

  2. Índices
    - Índice para consultas por usuário e status
    - Índice para consultas por data
    - Índice para consultas geográficas

  3. Segurança
    - Enable RLS na tabela `espectadores`
    - Políticas para usuários gerenciarem apenas seus próprios dados
*/

-- Criar tabela de espectadores
CREATE TABLE IF NOT EXISTS espectadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  user_agent text,
  pais text,
  cidade text,
  latitude numeric,
  longitude numeric,
  dispositivo text,
  navegador text,
  resolucao text,
  tempo_visualizacao integer DEFAULT 0,
  ativo boolean DEFAULT true,
  referrer text,
  created_at timestamptz DEFAULT now(),
  ultima_atividade timestamptz DEFAULT now(),
  desconectado_em timestamptz
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_espectadores_user_ativo 
  ON espectadores(id_user, ativo);

CREATE INDEX IF NOT EXISTS idx_espectadores_created_at 
  ON espectadores(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_espectadores_ultima_atividade 
  ON espectadores(ultima_atividade DESC);

CREATE INDEX IF NOT EXISTS idx_espectadores_localizacao 
  ON espectadores(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_espectadores_ip_hash 
  ON espectadores(ip_hash);

-- Adicionar constraint para dispositivo
ALTER TABLE espectadores 
ADD CONSTRAINT espectadores_dispositivo_check 
CHECK (dispositivo IN ('desktop', 'mobile', 'tablet', 'tv', 'unknown'));

-- Enable RLS
ALTER TABLE espectadores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own analytics"
  ON espectadores
  FOR SELECT
  TO authenticated
  USING (id_user = auth.uid());

CREATE POLICY "System can insert analytics"
  ON espectadores
  FOR INSERT
  TO authenticated
  WITH CHECK (id_user = auth.uid());

CREATE POLICY "Users can update their own analytics"
  ON espectadores
  FOR UPDATE
  TO authenticated
  USING (id_user = auth.uid());

-- Adicionar colunas relay nas tabelas existentes se não existirem
DO $$
BEGIN
  -- Adicionar colunas de relay na tabela streams se não existirem
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'relay_status'
  ) THEN
    ALTER TABLE streams ADD COLUMN relay_status text DEFAULT 'inativo' CHECK (relay_status IN ('ativo', 'inativo', 'erro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'relay_url'
  ) THEN
    ALTER TABLE streams ADD COLUMN relay_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'relay_type'
  ) THEN
    ALTER TABLE streams ADD COLUMN relay_type text DEFAULT 'rtmp' CHECK (relay_type IN ('rtmp', 'm3u8', 'hls'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'relay_error_details'
  ) THEN
    ALTER TABLE streams ADD COLUMN relay_error_details text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'relay_started_at'
  ) THEN
    ALTER TABLE streams ADD COLUMN relay_started_at timestamptz;
  END IF;
END $$;

-- Criar view para estatísticas de espectadores por usuário
CREATE OR REPLACE VIEW user_viewer_stats AS
SELECT 
  id_user,
  COUNT(*) as total_sessoes,
  COUNT(*) FILTER (WHERE ativo = true) as sessoes_ativas,
  AVG(tempo_visualizacao) as tempo_medio_visualizacao,
  SUM(tempo_visualizacao) as tempo_total_visualizacao,
  COUNT(DISTINCT ip_hash) as espectadores_unicos,
  COUNT(DISTINCT pais) as paises_diferentes,
  COUNT(DISTINCT cidade) as cidades_diferentes,
  COUNT(*) FILTER (WHERE dispositivo = 'mobile') as sessoes_mobile,
  COUNT(*) FILTER (WHERE dispositivo = 'desktop') as sessoes_desktop,
  COUNT(*) FILTER (WHERE dispositivo = 'tablet') as sessoes_tablet,
  MAX(created_at) as ultima_sessao
FROM espectadores
GROUP BY id_user;

-- Criar view para estatísticas geográficas
CREATE OR REPLACE VIEW viewer_geographic_stats AS
SELECT 
  id_user,
  pais,
  cidade,
  COUNT(*) as total_espectadores,
  COUNT(*) FILTER (WHERE ativo = true) as espectadores_ativos,
  AVG(tempo_visualizacao) as tempo_medio,
  COUNT(DISTINCT ip_hash) as ips_unicos,
  AVG(latitude) as latitude_media,
  AVG(longitude) as longitude_media
FROM espectadores
WHERE pais IS NOT NULL
GROUP BY id_user, pais, cidade
ORDER BY total_espectadores DESC;