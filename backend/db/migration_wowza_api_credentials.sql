-- Migration: Add Wowza API credentials fields to wowza_servers table
-- This allows storing API authentication credentials for each Wowza server

-- Add usuario_api and senha_api columns to wowza_servers table
ALTER TABLE wowza_servers
ADD COLUMN IF NOT EXISTS `usuario_api` VARCHAR(100) NULL DEFAULT 'admin' COMMENT 'Usuário da API REST do Wowza' AFTER `porta_api`,
ADD COLUMN IF NOT EXISTS `senha_api` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Senha da API REST do Wowza' AFTER `usuario_api`;

-- Update existing records to have default admin credentials if not set
UPDATE wowza_servers
SET usuario_api = 'admin', senha_api = 'admin'
WHERE usuario_api IS NULL OR senha_api IS NULL;

-- Add index for faster lookups
ALTER TABLE wowza_servers
ADD INDEX IF NOT EXISTS `idx_wowza_api_enabled` (`status`, `porta_api`);

-- Success message
SELECT 'Migration completed successfully! Added usuario_api and senha_api columns to wowza_servers table.' as message;
