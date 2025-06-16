import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET /api/comerciais - Lista configurações de comerciais do usuário
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('comerciais_config')
      .select(`
        *,
        playlist:playlists!comerciais_config_id_playlist_fkey (nome),
        folder:folders!comerciais_config_id_folder_comerciais_fkey (nome)
      `)
      .eq('id_user', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configurações de comerciais', details: err.message });
  }
});

// POST /api/comerciais - Cria nova configuração de comerciais
router.post('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id_playlist, id_folder_comerciais, quantidade_comerciais, intervalo_videos, ativo } = req.body;

    if (!id_playlist || !id_folder_comerciais || !quantidade_comerciais || !intervalo_videos) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Verifica se a playlist pertence ao usuário
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id')
      .eq('id', id_playlist)
      .eq('id_user', userId)
      .single();

    if (playlistError || !playlist) {
      return res.status(404).json({ error: 'Playlist não encontrada ou sem permissão' });
    }

    // Verifica se a pasta pertence ao usuário
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', id_folder_comerciais)
      .eq('id_user', userId)
      .single();

    if (folderError || !folder) {
      return res.status(404).json({ error: 'Pasta não encontrada ou sem permissão' });
    }

    // Verifica se já existe configuração para esta playlist
    const { data: existing } = await supabase
      .from('comerciais_config')
      .select('id')
      .eq('id_playlist', id_playlist)
      .eq('id_user', userId)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Já existe uma configuração de comerciais para esta playlist' });
    }

    // Cria a configuração
    const { data, error } = await supabase
      .from('comerciais_config')
      .insert([{
        id_user: userId,
        id_playlist,
        id_folder_comerciais,
        quantidade_comerciais,
        intervalo_videos,
        ativo: ativo !== false
      }])
      .select()
      .single();

    if (error) throw error;

    // Aplica os comerciais na playlist
    await aplicarComerciaisNaPlaylist(id_playlist, id_folder_comerciais, quantidade_comerciais, intervalo_videos, userId);

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar configuração de comerciais', details: err.message });
  }
});

// PUT /api/comerciais/:id - Atualiza configuração de comerciais
router.put('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    // Verifica se a configuração pertence ao usuário
    const { data: config, error: configError } = await supabase
      .from('comerciais_config')
      .select('*')
      .eq('id', id)
      .eq('id_user', userId)
      .single();

    if (configError || !config) {
      return res.status(404).json({ error: 'Configuração não encontrada ou sem permissão' });
    }

    const { data, error } = await supabase
      .from('comerciais_config')
      .update(updateData)
      .eq('id', id)
      .eq('id_user', userId)
      .select()
      .single();

    if (error) throw error;

    // Se foi atualizada a configuração principal, reaplica os comerciais
    if (updateData.quantidade_comerciais || updateData.intervalo_videos || updateData.id_folder_comerciais) {
      await aplicarComerciaisNaPlaylist(
        data.id_playlist,
        data.id_folder_comerciais,
        data.quantidade_comerciais,
        data.intervalo_videos,
        userId
      );
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar configuração de comerciais', details: err.message });
  }
});

// DELETE /api/comerciais/:id - Remove configuração de comerciais
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Busca a configuração para obter o id_playlist
    const { data: config, error: configError } = await supabase
      .from('comerciais_config')
      .select('id_playlist')
      .eq('id', id)
      .eq('id_user', userId)
      .single();

    if (configError || !config) {
      return res.status(404).json({ error: 'Configuração não encontrada ou sem permissão' });
    }

    // Remove todos os comerciais da playlist
    await supabase
      .from('playlist_videos')
      .delete()
      .eq('id_playlist', config.id_playlist)
      .eq('tipo', 'comercial');

    // Remove a configuração
    const { error } = await supabase
      .from('comerciais_config')
      .delete()
      .eq('id', id)
      .eq('id_user', userId);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover configuração de comerciais', details: err.message });
  }
});

// Função auxiliar para aplicar comerciais na playlist
async function aplicarComerciaisNaPlaylist(idPlaylist, idFolderComerciais, quantidadeComerciais, intervaloVideos, userId) {
  try {
    // Remove comerciais existentes
    await supabase
      .from('playlist_videos')
      .delete()
      .eq('id_playlist', idPlaylist)
      .eq('tipo', 'comercial');

    // Busca vídeos da playlist (não comerciais)
    const { data: playlistVideos } = await supabase
      .from('playlist_videos')
      .select('*')
      .eq('id_playlist', idPlaylist)
      .neq('tipo', 'comercial')
      .order('ordem', { ascending: true });

    // Busca vídeos comerciais da pasta
    const { data: comerciaisVideos } = await supabase
      .from('videos')
      .select('*')
      .eq('id_folder', idFolderComerciais);

    if (!comerciaisVideos || comerciaisVideos.length === 0) {
      return; // Não há comerciais para inserir
    }

    if (!playlistVideos || playlistVideos.length === 0) {
      return; // Não há vídeos na playlist
    }

    // Reorganiza a ordem dos vídeos existentes e insere comerciais
    const novosVideos = [];
    let ordemAtual = 0;
    let comercialIndex = 0;

    for (let i = 0; i < playlistVideos.length; i++) {
      // Adiciona o vídeo normal
      novosVideos.push({
        ...playlistVideos[i],
        ordem: ordemAtual++
      });

      // Verifica se deve inserir comerciais
      if ((i + 1) % intervaloVideos === 0) {
        // Insere a quantidade especificada de comerciais
        for (let j = 0; j < quantidadeComerciais; j++) {
          const comercial = comerciaisVideos[comercialIndex % comerciaisVideos.length];
          novosVideos.push({
            id_playlist: idPlaylist,
            id_video: comercial.id,
            ordem: ordemAtual++,
            tipo: 'comercial'
          });
          comercialIndex++;
        }
      }
    }

    // Atualiza todas as ordens
    for (const video of novosVideos) {
      if (video.id) {
        // Atualiza vídeo existente
        await supabase
          .from('playlist_videos')
          .update({ ordem: video.ordem })
          .eq('id', video.id);
      } else {
        // Insere novo comercial
        await supabase
          .from('playlist_videos')
          .insert(video);
      }
    }

  } catch (error) {
    console.error('Erro ao aplicar comerciais na playlist:', error);
    throw error;
  }
}

export default router;