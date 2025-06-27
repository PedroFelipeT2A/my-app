import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import multer from 'multer';
import { promisify } from 'util';

const router = express.Router();
const ffprobePromise = promisify(ffmpeg.ffprobe);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'videos/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const folderId = parseInt(req.query.folder_id, 10);
    const id_user = req.user.id;

    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Parâmetro folder_id inválido' });
    }

    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('id_user', id_user)
      .single();

    if (folderError || !folder) {
      return res.status(403).json({ error: 'Pasta não encontrada ou não pertence ao usuário' });
    }

    const { data, error } = await supabase
      .from('videos')
      .select('id, nome, duracao, filename, tamanho, url, created_at')
      .eq('id_folder', folderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vídeos', details: err.message });
  }
});

router.post('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { nome, filename, id_folder, duracao, tamanho, url } = req.body;
    if (!nome || !filename || !id_folder) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const { data, error } = await supabase
      .from('videos')
      .insert([{ nome, filename, id_folder, duracao, tamanho, url }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar vídeo', details: err.message });
  }
});

// DELETE /api/videos/:id - Deletar vídeo com verificações
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(videoId)) {
      return res.status(400).json({ error: 'ID do vídeo inválido' });
    }

    // Verificar se o vídeo pertence ao usuário
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        *,
        folder:folders!inner(id_user)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video || video.folder.id_user !== userId) {
      return res.status(404).json({ error: 'Vídeo não encontrado ou sem permissão' });
    }

    // Verificar se o vídeo está em alguma playlist
    const { data: playlistVideos, error: playlistError } = await supabase
      .from('playlist_videos')
      .select(`
        id,
        playlist:playlists!inner(nome, id_user)
      `)
      .eq('id_video', videoId);

    if (playlistError) {
      console.error('Erro ao verificar playlists:', playlistError);
    }

    // Filtrar apenas playlists do usuário
    const userPlaylists = playlistVideos?.filter(pv => pv.playlist.id_user === userId) || [];

    if (userPlaylists.length > 0) {
      const playlistNames = userPlaylists.map(pv => pv.playlist.nome).join(', ');
      return res.status(400).json({ 
        error: 'Não é possível deletar o vídeo',
        details: `Este vídeo está sendo usado nas seguintes playlists: ${playlistNames}. Remova o vídeo das playlists primeiro.`,
        playlists: userPlaylists.map(pv => pv.playlist.nome)
      });
    }

    // Verificar se há transmissões ativas usando este vídeo
    const { data: activeTransmissions } = await supabase
      .from('transmissions')
      .select(`
        id,
        titulo,
        playlist:playlists!inner(
          playlist_videos!inner(id_video)
        )
      `)
      .eq('id_user', userId)
      .in('status', ['ativa', 'preparando']);

    const transmissionsUsingVideo = activeTransmissions?.filter(t => 
      t.playlist?.playlist_videos?.some(pv => pv.id_video === videoId)
    ) || [];

    if (transmissionsUsingVideo.length > 0) {
      const transmissionTitles = transmissionsUsingVideo.map(t => t.titulo).join(', ');
      return res.status(400).json({
        error: 'Não é possível deletar o vídeo',
        details: `Este vídeo está sendo usado em transmissões ativas: ${transmissionTitles}. Pare as transmissões primeiro.`
      });
    }

    // Deletar o vídeo
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) throw deleteError;

    // Tentar deletar o arquivo físico
    try {
      if (video.filename) {
        const filePath = `videos/${video.filename}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (fileError) {
      console.error('Erro ao deletar arquivo físico:', fileError);
      // Não falhar a operação se não conseguir deletar o arquivo
    }

    res.status(204).send();
  } catch (err) {
    console.error('Erro ao deletar vídeo:', err);
    res.status(500).json({ error: 'Erro ao deletar vídeo', details: err.message });
  }
});

router.post('/upload', supabaseAuthMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { folder_id } = req.body;
    const id_user = req.user.id;
    const parsedFolderId = parseInt(folder_id, 10);

    if (isNaN(parsedFolderId)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Parâmetro folder_id inválido' });
    }

    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', parsedFolderId)
      .eq('id_user', id_user)
      .single();

    if (folderError || !folder) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Pasta não encontrada ou não pertence ao usuário' });
    }

    const metadata = await ffprobePromise(req.file.path);
    const duration = metadata.format.duration;
    const size = req.file.size;

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/videos/${req.file.filename}`;

    const { data, error } = await supabase
      .from('videos')
      .insert([{
        nome: req.file.originalname,
        filename: req.file.filename,
        id_folder: parsedFolderId,
        duracao: duration,
        tamanho: size,
        url,
      }])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro no processamento do vídeo', details: err.message });
  }
});

export default router;