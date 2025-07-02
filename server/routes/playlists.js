import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET playlists do usuário autenticado
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const id_user = req.user.id;

    const { data, error } = await supabase
      .from('playlists')
      .select('id, nome')
      .eq('id_user', id_user)
      .order('id');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar playlists', details: err.message });
  }
});

// POST nova playlist
router.post('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome da playlist é obrigatório' });
    const id_user = req.user.id;

    const { data, error } = await supabase.from('playlists').insert([{ nome, id_user }]).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar playlist', details: err.message });
  }
});

// PUT atualizar nome da playlist
router.put('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    const { nome } = req.body;
    if (isNaN(idNum) || !nome) return res.status(400).json({ error: 'Dados inválidos' });

    const { data, error } = await supabase
      .from('playlists')
      .update({ nome })
      .eq('id', idNum)
      .eq('id_user', req.user.id)
      .select();

    if (error) throw error;
    if (data.length === 0) return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar playlist', details: err.message });
  }
});

// DELETE playlist com verificações
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(idNum)) return res.status(400).json({ error: 'ID inválido' });

    // Verificar se a playlist pertence ao usuário
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, nome')
      .eq('id', idNum)
      .eq('id_user', userId)
      .single();

    if (playlistError || !playlist) {
      return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });
    }

    // Verificar se há transmissões ativas usando esta playlist
    const { data: activeTransmissions } = await supabase
      .from('transmissions')
      .select('id, titulo')
      .eq('id_playlist', idNum)
      .eq('id_user', userId)
      .in('status', ['ativa', 'preparando']);

    if (activeTransmissions && activeTransmissions.length > 0) {
      const transmissionTitles = activeTransmissions.map(t => t.titulo).join(', ');
      return res.status(400).json({
        error: 'Não é possível deletar a playlist',
        details: `A playlist "${playlist.nome}" está sendo usada em transmissões ativas: ${transmissionTitles}. Pare as transmissões primeiro.`
      });
    }

    // Verificar se há agendamentos usando esta playlist
    const { data: agendamentos } = await supabase
      .from('playlists_agendamentos')
      .select('id')
      .eq('id_playlist', idNum)
      .eq('id_user', userId);

    if (agendamentos && agendamentos.length > 0) {
      return res.status(400).json({
        error: 'Não é possível deletar a playlist',
        details: `A playlist "${playlist.nome}" está sendo usada em ${agendamentos.length} agendamento(s). Remova os agendamentos primeiro.`
      });
    }

    // Verificar se há configurações de comerciais usando esta playlist
    const { data: comerciaisConfig } = await supabase
      .from('comerciais_config')
      .select('id')
      .eq('id_playlist', idNum)
      .eq('id_user', userId);

    if (comerciaisConfig && comerciaisConfig.length > 0) {
      return res.status(400).json({
        error: 'Não é possível deletar a playlist',
        details: `A playlist "${playlist.nome}" está sendo usada em configurações de comerciais. Remova as configurações primeiro.`
      });
    }

    // Deletar vídeos da playlist primeiro
    await supabase
      .from('playlist_videos')
      .delete()
      .eq('id_playlist', idNum);

    // Deletar a playlist
    const { error: deleteError } = await supabase
      .from('playlists')
      .delete()
      .eq('id', idNum)
      .eq('id_user', userId);

    if (deleteError) throw deleteError;

    res.status(204).send();
  } catch (err) {
    console.error('Erro ao excluir playlist:', err);
    res.status(500).json({ error: 'Erro ao excluir playlist', details: err.message });
  }
});

// GET vídeos da playlist com ordem
router.get('/:id/videos', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idPlaylist = parseInt(req.params.id, 10);
    if (isNaN(idPlaylist)) return res.status(400).json({ error: 'ID inválido' });

    // Verifica se a playlist pertence ao usuário
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id')
      .eq('id', idPlaylist)
      .eq('id_user', req.user.id)
      .single();

    if (playlistError) throw playlistError;
    if (!playlist) return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });

    // Busca vídeos na playlist com dados do vídeo
    const { data, error } = await supabase
      .from('playlist_videos')
      .select('id, ordem, videos(*)')
      .eq('id_playlist', idPlaylist)
      .order('ordem', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vídeos da playlist', details: err.message });
  }
});

// POST adicionar vídeo à playlist (no final)
router.post('/:id/videos', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idPlaylist = parseInt(req.params.id, 10);
    const { id_video } = req.body;

    if (isNaN(idPlaylist) || !id_video) return res.status(400).json({ error: 'Dados inválidos' });

    // Verifica se playlist pertence ao usuário
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id')
      .eq('id', idPlaylist)
      .eq('id_user', req.user.id)
      .single();

    if (playlistError) throw playlistError;
    if (!playlist) return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });

    // Busca maior ordem atual
    const { data: maxOrderData, error: maxOrderError } = await supabase
      .from('playlist_videos')
      .select('ordem')
      .eq('id_playlist', idPlaylist)
      .order('ordem', { ascending: false })
      .limit(1);

    if (maxOrderError) throw maxOrderError;

    const maxOrder = (maxOrderData && maxOrderData.length > 0) ? maxOrderData[0].ordem : -1;
    const novaOrdem = maxOrder + 1;

    // Insere vídeo na playlist com nova ordem
    const { data, error } = await supabase
      .from('playlist_videos')
      .insert([{ id_playlist: idPlaylist, id_video, ordem: novaOrdem }])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar vídeo na playlist', details: err.message });
  }
});

// PUT atualizar ordem dos vídeos na playlist
router.put('/:id/videos/order', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idPlaylist = parseInt(req.params.id, 10);
    const { orderUpdates } = req.body; // array [{ id: playlist_video_id, ordem: number }, ...]

    if (isNaN(idPlaylist) || !Array.isArray(orderUpdates)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Verifica permissão na playlist
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id')
      .eq('id', idPlaylist)
      .eq('id_user', req.user.id)
      .single();

    if (playlistError) throw playlistError;
    if (!playlist) return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });

    // Atualiza cada registro (ideal: fazer em batch ou transaction)
    for (const item of orderUpdates) {
      await supabase
        .from('playlist_videos')
        .update({ ordem: item.ordem })
        .eq('id', item.id)
        .eq('id_playlist', idPlaylist);
    }

    res.json({ message: 'Ordem atualizada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar ordem', details: err.message });
  }
});

// DELETE remover vídeo da playlist
router.delete('/:id/videos/:idVideo', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idPlaylist = parseInt(req.params.id, 10);
    const idVideoPlaylist = parseInt(req.params.idVideo, 10);

    if (isNaN(idPlaylist) || isNaN(idVideoPlaylist)) return res.status(400).json({ error: 'IDs inválidos' });

    // Verifica permissão na playlist
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id')
      .eq('id', idPlaylist)
      .eq('id_user', req.user.id)
      .single();

    if (playlistError) throw playlistError;
    if (!playlist) return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });

    // Deleta o vídeo da playlist
    const { data, error } = await supabase
      .from('playlist_videos')
      .delete()
      .eq('id', idVideoPlaylist)
      .eq('id_playlist', idPlaylist);

    if (error) throw error;
    if (data.length === 0) return res.status(404).json({ error: 'Vídeo na playlist não encontrado' });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover vídeo da playlist', details: err.message });
  }
});

export default router;