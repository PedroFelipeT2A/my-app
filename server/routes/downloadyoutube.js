import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import youtubedl from 'youtube-dl-exec';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.post('/', supabaseAuthMiddleware, async (req, res) => {
  const { url, id_pasta } = req.body;
  const userId = req.user.id;

  if (!url || !id_pasta) {
    return res.status(400).json({ error: 'URL e pasta são obrigatórios' });
  }

  try {
    // Pega as infos do vídeo (sem usar exec)
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      youtubeSkipDashManifest: true,
    });

    const nomeArquivo = `${info.title}.mp4`.replace(/[<>:"/\\|?*]+/g, '');

    // Salvar dentro da pasta uploads/userId/id_pasta, caminho relativo e seguro
    const pastaLocal = path.resolve(`uploads/${userId}/${id_pasta}`);
    fs.mkdirSync(pastaLocal, { recursive: true });

    const caminhoArquivo = path.join(pastaLocal, nomeArquivo);

    // Baixa o vídeo com melhor qualidade e áudio (sem usar exec)
    await youtubedl(url, {
      output: caminhoArquivo,
      format: 'bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
    });

    // Salva no banco
    const { data, error } = await supabase
      .from('videos')
      .insert([
        {
          nome: nomeArquivo,
          folder_id: id_pasta,
          id_user: userId,
          url: `/uploads/${userId}/${id_pasta}/${nomeArquivo}`,
          tamanho: fs.statSync(caminhoArquivo).size,
          duracao: Math.floor(info.duration),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar no banco:', error);
      return res.status(500).json({ error: 'Erro ao salvar no banco' });
    }

    res.json({ video: data });
  } catch (error) {
    console.error('Erro no download do vídeo:', error);
    res.status(500).json({ error: 'Erro ao processar download' });
  }
});

export default router;
