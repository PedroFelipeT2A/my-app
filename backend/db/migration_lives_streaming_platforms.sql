-- Migration: Lives and Streaming Platforms Tables
-- Description: Criar tabelas para gerenciamento de transmissões ao vivo para redes sociais

-- Tabela de lives (transmissões ao vivo para redes sociais)
CREATE TABLE IF NOT EXISTS lives (
    codigo INT AUTO_INCREMENT PRIMARY KEY,
    codigo_stm INT NOT NULL,
    data_inicio DATETIME DEFAULT NULL,
    data_fim DATETIME DEFAULT NULL,
    tipo VARCHAR(50) NOT NULL COMMENT 'youtube, facebook, twitch, tiktok, kwai, custom',
    live_servidor VARCHAR(255) NOT NULL COMMENT 'Servidor RTMP da plataforma',
    live_app VARCHAR(255) NOT NULL COMMENT 'Application path do RTMP',
    live_chave VARCHAR(500) NOT NULL COMMENT 'Stream key da plataforma',
    status ENUM('0', '1', '2') DEFAULT '2' COMMENT '0=Encerrada, 1=Ativa, 2=Agendada',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo_stm (codigo_stm),
    INDEX idx_status (status),
    INDEX idx_data_inicio (data_inicio),
    FOREIGN KEY (codigo_stm) REFERENCES streamings(codigo_cliente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Transmissões ao vivo para redes sociais';

-- Tabela de plataformas de streaming
CREATE TABLE IF NOT EXISTS streaming_platforms (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    rtmp_base_url VARCHAR(500) NOT NULL COMMENT 'URL base RTMP da plataforma',
    requer_stream_key BOOLEAN DEFAULT TRUE,
    supports_https BOOLEAN DEFAULT FALSE,
    special_config TEXT DEFAULT NULL COMMENT 'Configurações especiais em JSON',
    ativo BOOLEAN DEFAULT TRUE,
    ordem INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Plataformas de streaming disponíveis';

-- Inserir plataformas padrão
INSERT INTO streaming_platforms (id, nome, rtmp_base_url, requer_stream_key, supports_https, ordem, ativo) VALUES
('youtube', 'YouTube Live', 'rtmp://a.rtmp.youtube.com/live2/', TRUE, TRUE, 1, TRUE),
('facebook', 'Facebook Live', 'rtmps://live-api-s.facebook.com:443/rtmp/', TRUE, TRUE, 2, TRUE),
('twitch', 'Twitch', 'rtmp://live.twitch.tv/app/', TRUE, FALSE, 3, TRUE),
('tiktok', 'TikTok Live', 'rtmp://live.tiktok.com/live/', TRUE, FALSE, 4, TRUE),
('kwai', 'Kwai Live', 'rtmp://push.kwai.com/live/', TRUE, FALSE, 5, TRUE),
('custom', 'Servidor Personalizado', '', TRUE, FALSE, 99, TRUE)
ON DUPLICATE KEY UPDATE
    nome = VALUES(nome),
    rtmp_base_url = VALUES(rtmp_base_url),
    requer_stream_key = VALUES(requer_stream_key),
    supports_https = VALUES(supports_https),
    ordem = VALUES(ordem),
    ativo = VALUES(ativo);

-- Adicionar colunas de configuração da API Wowza na tabela wowza_servers (se não existirem)
ALTER TABLE wowza_servers
ADD COLUMN IF NOT EXISTS porta_api INT DEFAULT 8087 COMMENT 'Porta da API REST do Wowza',
ADD COLUMN IF NOT EXISTS usuario_api VARCHAR(100) DEFAULT 'admin' COMMENT 'Usuário da API REST do Wowza',
ADD COLUMN IF NOT EXISTS senha_api VARCHAR(255) DEFAULT 'admin' COMMENT 'Senha da API REST do Wowza';

-- Adicionar índices para melhor performance
ALTER TABLE lives
ADD INDEX IF NOT EXISTS idx_tipo (tipo),
ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Comentário final
SELECT 'Migration completed: Lives and Streaming Platforms tables created successfully' as status;
