import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET /api/folders — lista pastas do usuário
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const id_user = req.user.id;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id_user', id_user)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pastas', details: err.message });
  }
});

// POST /api/folders — cria nova pasta
router.post('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { nome } = req.body;
    const id_user = req.user.id;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório.' });
    }

    const { data, error } = await supabase
      .from('folders')
      .insert([{ nome, id_user }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar pasta', details: err.message });
  }
});

// DELETE /api/folders/:id — apaga pasta com verificações
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(idNum)) return res.status(400).json({ error: 'ID inválido' });

    // Verificar se a pasta pertence ao usuário
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, nome')
      .eq('id', idNum)
      .eq('id_user', userId)
      .single();

    if (folderError || !folder) {
      return res.status(404).json({ error: 'Pasta não encontrada ou sem permissão' });
    }

    // Verificar se há vídeos na pasta
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, nome')
      .eq('id_folder', idNum);

    if (videosError) {
      console.error('Erro ao verificar vídeos:', videosError);
    }

    if (videos && videos.length > 0) {
      return res.status(400).json({
        error: 'Não é possível deletar a pasta',
        details: `A pasta "${folder.nome}" contém ${videos.length} vídeo(s). Remova ou mova os vídeos primeiro.`,
        videoCount: videos.length
      });
    }

    // Verificar se a pasta é usada em configurações de comerciais
    const { data: comerciaisConfig } = await supabase
      .from('comerciais_config')
      .select('id')
      .eq('id_folder_comerciais', idNum)
      .eq('id_user', userId);

    if (comerciaisConfig && comerciaisConfig.length > 0) {
      return res.status(400).json({
        error: 'Não é possível deletar a pasta',
        details: `A pasta "${folder.nome}" está sendo usada em configurações de comerciais. Remova as configurações primeiro.`
      });
    }

    // Deletar a pasta
    const { error: deleteError } = await supabase
      .from('folders')
      .delete()
      .eq('id', idNum)
      .eq('id_user', userId);

    if (deleteError) throw deleteError;

    res.status(204).send();
  } catch (err) {
    console.error('Erro ao excluir pasta:', err);
    res.status(500).json({ error: 'Erro ao excluir pasta', details: err.message });
  }
});

export default router;