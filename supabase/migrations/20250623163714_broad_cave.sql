/*
  # Atualização da tabela streams para integração com Wowza

  1. Modificações
    - Adicionar campos para integração com transmissões
    - Campos para estatísticas em tempo real
    - Referência para transmissão ativa

  2. Segurança
    - Manter RLS existente
    - Adicionar políticas para acesso aos dados de stream
*/

-- Adicionar campos à tabela streams existente
DO $$
BEGIN
  -- Adicionar campo de referência para transmissão
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'transmission_id'
  ) THEN
    ALTER TABLE streams ADD COLUMN transmission_id uuid REFERENCES transmissions(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar campos para estatísticas detalhadas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'wowza_stream_name'
  ) THEN
    ALTER TABLE streams ADD COLUMN wowza_stream_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'wowza_application'
  ) THEN
    ALTER TABLE streams ADD COLUMN wowza_application text DEFAULT 'live';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'quality_settings'
  ) THEN
    ALTER TABLE streams ADD COLUMN quality_settings jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'last_stats_update'
  ) THEN
    ALTER TABLE streams ADD COLUMN last_stats_update timestamptz DEFAULT now();
  END IF;
END $$;

-- Habilitar RLS se não estiver habilitado
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus streams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'streams' AND policyname = 'Users can manage their own streams'
  ) THEN
    CREATE POLICY "Users can manage their own streams"
      ON streams
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;