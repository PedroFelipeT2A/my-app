-- Migration: Create playlist_videos table for many-to-many relationship
-- This allows videos to be added to multiple playlists and the same video
-- can appear multiple times in the same playlist

-- Create playlist_videos table if it doesn't exist
CREATE TABLE IF NOT EXISTS playlist_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  playlist_id INT NOT NULL,
  video_id INT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_playlist (playlist_id),
  INDEX idx_video (video_id),
  INDEX idx_ordem (playlist_id, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing data from videos table (where playlist_id is set)
INSERT IGNORE INTO playlist_videos (playlist_id, video_id, ordem)
SELECT
  v.playlist_id,
  v.id as video_id,
  COALESCE(v.ordem_playlist, 0) as ordem
FROM videos v
WHERE v.playlist_id IS NOT NULL
ORDER BY v.playlist_id, v.ordem_playlist, v.id;

-- Add transmissoes table if it doesn't exist (for tracking active transmissions)
CREATE TABLE IF NOT EXISTS transmissoes (
  codigo INT AUTO_INCREMENT PRIMARY KEY,
  codigo_stm INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  codigo_playlist INT,
  status ENUM('ativa', 'finalizada', 'pausada') DEFAULT 'ativa',
  data_inicio DATETIME,
  data_fim DATETIME,
  tipo_transmissao VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_codigo_stm (codigo_stm),
  INDEX idx_status (status),
  INDEX idx_codigo_playlist (codigo_playlist),
  FOREIGN KEY (codigo_stm) REFERENCES clientes(codigo) ON DELETE CASCADE,
  FOREIGN KEY (codigo_playlist) REFERENCES playlists(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Success message
SELECT 'Migration completed successfully!' as message;
