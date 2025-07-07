const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/playlists - Lista playlists do usuário
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      'SELECT codigo as id, nome FROM playlists WHERE codigo_stm = ? ORDER BY codigo',
      [userId]
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
    if (!nome) return res.status(400).json({ error: 'Nome da playlist é obrigatório' });
    
    const userId = req.user.id;

    const [result] = await db.execute(
      'INSERT INTO playlists (nome, codigo_stm, data_criacao) VALUES (?, ?, NOW())',
      [nome, userId]
    );

    const [newPlaylist] = await db.execute(
      'SELECT codigo as id, nome FROM playlists WHERE codigo = ?',
      [result.insertId]
    );

    res.status(201).json(newPlaylist[0]);
  } catch (err) {
    console.error('Erro ao criar playlist:', err);
    res.status(500).json({ error: 'Erro ao criar playlist', details: err.message });
  }
});

// GET /api/playlists/:id/videos - Lista vídeos da playlist
router.get('/:id/videos', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      'SELECT codigo FROM playlists WHERE codigo = ? AND codigo_stm = ?',
      [playlistId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    const [rows] = await db.execute(
      `SELECT 
        pv.codigo as id,
        pv.ordem,
        pv.video as nome,
        pv.path_video as url,
        pv.duracao_segundos as duracao
       FROM playlists_videos pv
       WHERE pv.codigo_playlist = ?
       ORDER BY pv.ordem`,
      [playlistId]
    );

    const userEmail = req.user.email.split('@')[0];
    
    // Ajustar URLs para serem acessíveis
    const videos = rows.map(video => ({
      id: video.id,
      ordem: video.ordem,
      videos: {
        id: video.id,
        nome: video.nome,
        url: video.url ? `/content${video.url}` : null,
        duracao: video.duracao
      }
    }));

    res.json(videos);
  } catch (err) {
    console.error('Erro ao buscar vídeos da playlist:', err);
    res.status(500).json({ error: 'Erro ao buscar vídeos da playlist', details: err.message });
  }
});

// PUT /api/playlists/:id - Atualiza playlist
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const { nome, videos } = req.body;
    const userId = req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      'SELECT codigo FROM playlists WHERE codigo = ? AND codigo_stm = ?',
      [playlistId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    // Atualizar nome da playlist
    if (nome) {
      await db.execute(
        'UPDATE playlists SET nome = ? WHERE codigo = ?',
        [nome, playlistId]
      );
    }

    // Atualizar vídeos se fornecidos
    if (videos && Array.isArray(videos)) {
      // Remover vídeos existentes
      await db.execute(
        'DELETE FROM playlists_videos WHERE codigo_playlist = ?',
        [playlistId]
      );

      // Inserir novos vídeos
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        await db.execute(
          `UPDATE playlists_videos SET 
           codigo_playlist = ?, ordem = ? 
           WHERE codigo = ?`,
          [playlistId, i, video.id]
        );
      }
    }

    res.json({ success: true, message: 'Playlist atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar playlist:', err);
    res.status(500).json({ error: 'Erro ao atualizar playlist', details: err.message });
  }
});

// DELETE /api/playlists/:id - Remove playlist
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    // Verificar se playlist pertence ao usuário
    const [playlistRows] = await db.execute(
      'SELECT codigo FROM playlists WHERE codigo = ? AND codigo_stm = ?',
      [playlistId, userId]
    );

    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada' });
    }

    // Verificar se playlist está sendo usada em agendamentos
    const [agendamentoRows] = await db.execute(
      'SELECT codigo FROM playlists_agendamentos WHERE codigo_playlist = ?',
      [playlistId]
    );

    if (agendamentoRows.length > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir playlist que está sendo usada em agendamentos',
        details: 'Remova os agendamentos que usam esta playlist antes de excluí-la'
      });
    }

    // Remover vídeos da playlist
    await db.execute(
      'DELETE FROM playlists_videos WHERE codigo_playlist = ?',
      [playlistId]
    );

    // Remover playlist
    await db.execute(
      'DELETE FROM playlists WHERE codigo = ?',
      [playlistId]
    );

    res.json({ success: true, message: 'Playlist removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover playlist:', err);
    res.status(500).json({ error: 'Erro ao remover playlist', details: err.message });
  }
});

module.exports = router;