import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET /api/user-settings - Buscar configurações do usuário
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('id_user', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Se não existir configuração, retornar configurações padrão
    if (!data) {
      const defaultSettings = {
        theme: 'light',
        menu_items: [
          { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'Home', visible: true, order: 0, category: 'system' },
          { id: 'iniciar-transmissao', label: 'Iniciar Transmissão', path: '/dashboard/iniciar-transmissao', icon: 'Radio', visible: true, order: 1, category: 'streaming' },
          { id: 'dados-conexao', label: 'Dados de Conexão', path: '/dashboard/dados-conexao', icon: 'Wifi', visible: true, order: 2, category: 'streaming' },
          { id: 'players', label: 'Players', path: '/dashboard/players', icon: 'PlayCircle', visible: true, order: 3, category: 'streaming' },
          { id: 'gerenciarvideos', label: 'Gerenciar Vídeos', path: '/dashboard/gerenciarvideos', icon: 'FileVideo', visible: true, order: 4, category: 'content' },
          { id: 'playlists', label: 'Playlists', path: '/dashboard/playlists', icon: 'List', visible: true, order: 5, category: 'content' },
          { id: 'agendamentos', label: 'Agendamentos', path: '/dashboard/agendamentos', icon: 'Calendar', visible: true, order: 6, category: 'content' },
          { id: 'comerciais', label: 'Comerciais', path: '/dashboard/comerciais', icon: 'Megaphone', visible: true, order: 7, category: 'content' },
          { id: 'downloadyoutube', label: 'Download YouTube', path: '/dashboard/downloadyoutube', icon: 'Youtube', visible: true, order: 8, category: 'content' },
          { id: 'migrar-videos-ftp', label: 'Migrar FTP', path: '/dashboard/migrar-videos-ftp', icon: 'Server', visible: true, order: 9, category: 'content' },
          { id: 'espectadores', label: 'Espectadores', path: '/dashboard/espectadores', icon: 'Users', visible: true, order: 10, category: 'analytics' },
          { id: 'relayrtmp', label: 'Relay RTMP', path: '/dashboard/relayrtmp', icon: 'ArrowLeftRight', visible: true, order: 11, category: 'streaming' },
          { id: 'configuracoes', label: 'Configurações', path: '/dashboard/configuracoes', icon: 'Settings', visible: true, order: 12, category: 'system' },
        ],
        sidebar_collapsed: false,
        notifications_enabled: true,
        auto_refresh: true,
        refresh_interval: 30,
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo'
      };

      return res.json(defaultSettings);
    }

    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar configurações:', err);
    res.status(500).json({ error: 'Erro ao buscar configurações do usuário', details: err.message });
  }
});

// POST /api/user-settings - Salvar configurações do usuário
router.post('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const settingsData = {
      id_user: userId,
      theme: req.body.theme || 'light',
      menu_items: req.body.menu_items || [],
      sidebar_collapsed: req.body.sidebar_collapsed || false,
      notifications_enabled: req.body.notifications_enabled !== false,
      auto_refresh: req.body.auto_refresh !== false,
      refresh_interval: req.body.refresh_interval || 30,
      language: req.body.language || 'pt-BR',
      timezone: req.body.timezone || 'America/Sao_Paulo'
    };

    // Verificar se já existe configuração para o usuário
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('id_user', userId)
      .single();

    let result;
    if (existing) {
      // Atualizar configuração existente
      const { data, error } = await supabase
        .from('user_settings')
        .update(settingsData)
        .eq('id_user', userId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Criar nova configuração
      const { data, error } = await supabase
        .from('user_settings')
        .insert([settingsData])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
    res.status(500).json({ error: 'Erro ao salvar configurações do usuário', details: err.message });
  }
});

export default router;