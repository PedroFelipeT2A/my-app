const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/playlists - Lista playlists do usuário
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Para revendas, usar o ID efetivo do usuário
    const userId = req.user.effective_user_id || req.user.id;

    const [rows] = await db.execute(
      `SELECT 
        id,
        nome,
        data_criacao,
        total_videos,
        duracao_total
       FROM playlists 
       WHERE (codigo_stm = ? OR codigo_stm IN (
         SELECT codigo_cliente FROM streamings WHERE codigo_cliente = ?
       ))
       ORDER BY data_criacao DESC`,
      [userId, userId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar playlists:', err);
    res.status(500).json({ error: 'Erro ao buscar playlists', details: err.message });
  }
});

// POST /api/playlists - Cria nova playlist
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nome } = req.body;
    // Para revendas, usar o ID efetivo do usuário
    const userId = req.user.effective_user_id || req.user.id;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da playlist é obrigatório' });
    }

    const [result] = await db.execute(
      `INSERT INTO playlists (codigo_stm, nome, data_criacao, total_videos, duracao_total) 
       VALUES (?, ?, NOW(), 0, 0)`,
      [userId, nome]
    );

    // Atualizar arquivo SMIL do usuário após criar playlist
    try {
      const userLogin = req.user.usuario || `user_1`;
      const [serverRows] = await db.execute(
        `SELECT servidor_id FROM folders 
         WHERE (user_id = ? OR user_id IN (
           SELECT codigo FROM streamings WHERE codigo_cliente = ?
         )) LIMIT 1`,
        [userId, userId]
      );
      const serverId = serverRows.length > 0 ? serverRows[0].servidor_id : 1;
      
      const PlaylistSMILService = require('../services/PlaylistSMILService');
      await PlaylistSMILService.updateUserSMIL(userId, userLogin, serverId);
      console.log(`✅ Arquivo SMIL atualizado após criar playlist para usuário ${userLogin}`);
    } catch (smilError) {
      console.warn('Erro ao atualizar arquivo SMIL:', smilError.message);
    }
    res.status(201).json({
      id: result.insertId,
      nome: nome,
      message: 'Playlist criada com sucesso'
    });
  } catch (err) {
    console.error('Erro ao criar playlist:', err);
    res.status(500).json({ error: 'Erro ao criar playlist', details: err.message });
  }
});

// PUT /api/playlists/:id - Atualiza playlist
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const { nome, videos } = req.body;
    // Para revendas, usar o ID efetivo do usuário
    const userId = req.user.effective_user_id || req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      `SELECT id FROM playlists
       WHERE id = ? AND (codigo_stm = ? OR codigo_stm IN (
         SELECT codigo_cliente FROM streamings WHERE codigo_cliente = ?
       ))`,
      [playlistId, userId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    // Atualizar nome da playlist
    if (nome) {
      await db.execute(
        'UPDATE playlists SET nome = ? WHERE id = ?',
        [nome, playlistId]
      );
    }

    // Atualizar vídeos da playlist se fornecidos
    if (videos && Array.isArray(videos)) {
      // Verificar se tabela playlist_videos existe, se não criar
      try {
        await db.execute('SELECT 1 FROM playlist_videos LIMIT 1');
      } catch (tableError) {
        // Criar tabela playlist_videos
        await db.execute(`
          CREATE TABLE IF NOT EXISTS playlist_videos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            playlist_id INT NOT NULL,
            video_id INT NOT NULL,
            ordem INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_playlist (playlist_id),
            INDEX idx_video (video_id),
            UNIQUE KEY unique_playlist_video_ordem (playlist_id, video_id, ordem)
          )
        `);
        console.log('✅ Tabela playlist_videos criada com sucesso');
      }

      // Remover vídeos existentes da playlist (apenas da tabela intermediária)
      await db.execute(
        'DELETE FROM playlist_videos WHERE playlist_id = ?',
        [playlistId]
      );

      // Adicionar novos vídeos (permitindo duplicatas com ordem diferente)
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        await db.execute(
          'INSERT INTO playlist_videos (playlist_id, video_id, ordem) VALUES (?, ?, ?)',
          [playlistId, video.id, i]
        );
      }

      // Atualizar estatísticas da playlist
      const [statsRows] = await db.execute(
        `SELECT COUNT(DISTINCT pv.id) as total_videos, SUM(v.duracao) as duracao_total
         FROM playlist_videos pv
         INNER JOIN videos v ON pv.video_id = v.id
         WHERE pv.playlist_id = ?`,
        [playlistId]
      );

      const stats = statsRows[0];
      await db.execute(
        'UPDATE playlists SET total_videos = ?, duracao_total = ? WHERE id = ?',
        [stats.total_videos || 0, stats.duracao_total || 0, playlistId]
      );
    }

    // Atualizar arquivo SMIL do usuário após modificar playlist
    try {
      const userLogin = req.user.usuario || `user_1`;
      const [serverRows] = await db.execute(
        `SELECT servidor_id FROM folders 
         WHERE (user_id = ? OR user_id IN (
           SELECT codigo FROM streamings WHERE codigo_cliente = ?
         )) LIMIT 1`,
        [userId, userId]
      );
      const serverId = serverRows.length > 0 ? serverRows[0].servidor_id : 1;
      
      const PlaylistSMILService = require('../services/PlaylistSMILService');
      await PlaylistSMILService.updateUserSMIL(userId, userLogin, serverId);
      console.log(`✅ Arquivo SMIL atualizado após modificar playlist ${playlistId}`);
    } catch (smilError) {
      console.warn('Erro ao atualizar arquivo SMIL:', smilError.message);
    }

    res.json({ success: true, message: 'Playlist atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar playlist:', err);
    res.status(500).json({ error: 'Erro ao atualizar playlist', details: err.message });
  }
});

// GET /api/playlists/:id/videos - Lista vídeos de uma playlist
router.get('/:id/videos', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    // Para revendas, usar o ID efetivo do usuário
    const userId = req.user.effective_user_id || req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      `SELECT id FROM playlists
       WHERE id = ? AND (codigo_stm = ? OR codigo_stm IN (
         SELECT codigo_cliente FROM streamings WHERE codigo_cliente = ?
       ))`,
      [playlistId, userId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    // Verificar se tabela playlist_videos existe
    let useNewTable = false;
    try {
      await db.execute('SELECT 1 FROM playlist_videos LIMIT 1');
      useNewTable = true;
    } catch (tableError) {
      useNewTable = false;
    }

    let rows;
    if (useNewTable) {
      // Buscar vídeos da playlist usando tabela intermediária
      [rows] = await db.execute(
        `SELECT
          v.id,
          v.nome,
          v.url,
          v.caminho,
          v.duracao,
          v.tamanho_arquivo as tamanho,
          v.bitrate_video,
          v.formato_original,
          v.codec_video,
          v.is_mp4,
          v.compativel,
          pv.ordem as ordem_playlist
         FROM playlist_videos pv
         INNER JOIN videos v ON pv.video_id = v.id
         WHERE pv.playlist_id = ? AND (v.codigo_cliente = ? OR v.codigo_cliente IN (
           SELECT codigo FROM streamings WHERE codigo_cliente = ?
         ))
         ORDER BY pv.ordem ASC`,
        [playlistId, userId, userId]
      );
    } else {
      // Fallback para sistema antigo (playlist_id na tabela videos)
      [rows] = await db.execute(
        `SELECT
          v.id,
          v.nome,
          v.url,
          v.caminho,
          v.duracao,
          v.tamanho_arquivo as tamanho,
          v.bitrate_video,
          v.formato_original,
          v.codec_video,
          v.is_mp4,
          v.compativel,
          v.ordem_playlist
         FROM videos v
         WHERE v.playlist_id = ? AND (v.codigo_cliente = ? OR v.codigo_cliente IN (
           SELECT codigo FROM streamings WHERE codigo_cliente = ?
         ))
         ORDER BY v.ordem_playlist ASC, v.id ASC`,
        [playlistId, userId, userId]
      );
    }

    // Formatar resposta para compatibilidade com frontend
    const videos = rows.map(video => ({
      videos: video // Manter estrutura esperada pelo frontend
    }));

    res.json(videos);
  } catch (err) {
    console.error('Erro ao buscar vídeos da playlist:', err);
    res.status(500).json({ error: 'Erro ao buscar vídeos da playlist', details: err.message });
  }
});

// DELETE /api/playlists/:id - Remove playlist
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    // Para revendas, usar o ID efetivo do usuário
    const userId = req.user.effective_user_id || req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      `SELECT id, nome FROM playlists 
       WHERE id = ? AND (codigo_stm = ? OR codigo_stm IN (
         SELECT codigo_cliente FROM streamings WHERE codigo_cliente = ?
       ))`,
      [playlistId, userId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    const playlist = playlistRows[0];

    // Verificar se playlist está sendo usada em transmissão ativa
    const [activeTransmission] = await db.execute(
      'SELECT codigo FROM transmissoes WHERE codigo_playlist = ? AND status = "ativa"',
      [playlistId]
    );

    if (activeTransmission.length > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir playlist em transmissão',
        details: 'Finalize a transmissão antes de excluir a playlist'
      });
    }

    // Verificar se playlist está sendo usada em agendamentos
    const [agendamentos] = await db.execute(
      'SELECT COUNT(*) as count FROM playlists_agendamentos WHERE codigo_playlist = ?',
      [playlistId]
    );

    if (agendamentos[0].count > 0) {
      return res.status(400).json({ 
        error: 'Playlist está sendo usada em agendamentos',
        details: `A playlist "${playlist.nome}" está sendo usada em ${agendamentos[0].count} agendamento(s). Remova os agendamentos primeiro.`
      });
    }

    // Remover vídeos da playlist
    try {
      // Tentar remover da tabela intermediária primeiro
      await db.execute(
        'DELETE FROM playlist_videos WHERE playlist_id = ?',
        [playlistId]
      );
    } catch (tableError) {
      // Fallback para sistema antigo
      await db.execute(
        'UPDATE videos SET playlist_id = NULL, ordem_playlist = NULL WHERE playlist_id = ?',
        [playlistId]
      );
    }

    // Remover playlist
    await db.execute(
      'DELETE FROM playlists WHERE id = ?',
      [playlistId]
    );

    // Atualizar arquivo SMIL do usuário após remover playlist
    try {
      const userLogin = req.user.usuario || `user_1`;
      const [serverRows] = await db.execute(
        `SELECT servidor_id FROM folders 
         WHERE (user_id = ? OR user_id IN (
           SELECT codigo FROM streamings WHERE codigo_cliente = ?
         )) LIMIT 1`,
        [userId, userId]
      );
      const serverId = serverRows.length > 0 ? serverRows[0].servidor_id : 1;
      
      const PlaylistSMILService = require('../services/PlaylistSMILService');
      await PlaylistSMILService.updateUserSMIL(userId, userLogin, serverId);
    } catch (smilError) {
      console.warn('Erro ao atualizar arquivo SMIL:', smilError.message);
    }

    res.json({ success: true, message: 'Playlist excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao remover playlist:', err);
    res.status(500).json({ error: 'Erro ao remover playlist', details: err.message });
  }
});

module.exports = router;