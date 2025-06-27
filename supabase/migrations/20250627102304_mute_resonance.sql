/*
  # Configurações de Transmissão e Logo

  1. Novas Tabelas
    - `transmission_settings` - Configurações de transmissão por usuário
    - `logos` - Upload e gerenciamento de logos

  2. Campos Adicionados
    - Configurações de logo (posição, opacidade, tamanho)
    - Configurações de playlist (embaralhar, repetir)
    - URLs de logo e configurações visuais

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para usuários gerenciarem apenas seus dados
*/

-- Tabela para logos dos usuários
CREATE TABLE IF NOT EXISTS logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  tamanho bigint,
  tipo_arquivo text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own logos"
  ON logos
  FOR ALL
  TO authenticated
  USING (auth.uid() = id_user)
  WITH CHECK (auth.uid() = id_user);

-- Tabela para configurações de transmissão
CREATE TABLE IF NOT EXISTS transmission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Configuração Padrão',
  
  -- Configurações de logo
  id_logo uuid REFERENCES logos(id) ON DELETE SET NULL,
  logo_posicao text DEFAULT 'top-right' CHECK (logo_posicao IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
  logo_opacidade integer DEFAULT 80 CHECK (logo_opacidade >= 0 AND logo_opacidade <= 100),
  logo_tamanho text DEFAULT 'medium' CHECK (logo_tamanho IN ('small', 'medium', 'large')),
  logo_margem_x integer DEFAULT 20,
  logo_margem_y integer DEFAULT 20,
  
  -- Configurações de playlist
  embaralhar_videos boolean DEFAULT false,
  repetir_playlist boolean DEFAULT true,
  transicao_videos text DEFAULT 'fade' CHECK (transicao_videos IN ('none', 'fade', 'slide')),
  
  -- Configurações de qualidade
  resolucao text DEFAULT '1080p' CHECK (resolucao IN ('720p', '1080p', '1440p', '4k')),
  fps integer DEFAULT 30 CHECK (fps IN (24, 30, 60)),
  bitrate integer DEFAULT 2500,
  
  -- Configurações gerais
  titulo_padrao text,
  descricao_padrao text,
  ativo boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transmission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transmission settings"
  ON transmission_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = id_user)
  WITH CHECK (auth.uid() = id_user);

-- Adicionar campos à tabela transmissions para configurações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmissions' AND column_name = 'id_transmission_settings'
  ) THEN
    ALTER TABLE transmissions ADD COLUMN id_transmission_settings uuid REFERENCES transmission_settings(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transmissions' AND column_name = 'playlist_config'
  ) THEN
    ALTER TABLE transmissions ADD COLUMN playlist_config jsonb DEFAULT '{}';
  END IF;
END $$;

-- Inserir configuração padrão para usuários existentes
INSERT INTO transmission_settings (id_user, nome)
SELECT id, 'Configuração Padrão'
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM transmission_settings ts WHERE ts.id_user = users.id
);