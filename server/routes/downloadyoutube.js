import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import youtubedl from 'youtube-dl-exec';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Função para sanitizar nome de arquivo
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[<>:"/\\|?*]+/g, '') // Remove caracteres especiais do Windows
    .replace(/[^\w\s.-]/g, '') // Remove caracteres não alfanuméricos exceto espaços, pontos e hífens
    .replace(/\s+/g, '_') // Substitui espaços por underscore
    .replace(/_{2,}/g, '_') // Remove underscores duplos
    .trim()
    .substring(0, 200); // Limita o tamanho do nome
};

router.post('/', supabaseAuthMiddleware, async (req, res) => {
  const { url, id_pasta } = req.body;
  const userId = req.user.id;

  if (!url || !id_pasta) {
    return res.status(400).json({ error: 'URL e pasta são obrigatórios' });
  }

  // Validar URL do YouTube
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({ error: 'URL deve ser do YouTube' });
  }

  try {
    console.log('Iniciando download do YouTube:', url);

    // Verificar se a pasta pertence ao usuário
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', id_pasta)
      .eq('id_user', userId)
      .single();

    if (folderError || !folder) {
      return res.status(403).json({ error: 'Pasta não encontrada ou não pertence ao usuário' });
    }

    // Criar diretório se não existir
    const pastaLocal = path.resolve(`uploads/${userId}/${id_pasta}`);
    if (!fs.existsSync(pastaLocal)) {
      fs.mkdirSync(pastaLocal, { recursive: true });
    }

    // Obter informações do vídeo primeiro
    console.log('Obtendo informações do vídeo...');
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      youtubeSkipDashManifest: true,
      extractFlat: false
    });

    if (!info || !info.title) {
      throw new Error('Não foi possível obter informações do vídeo');
    }

    console.log('Título do vídeo:', info.title);

    // Sanitizar nome do arquivo
    const tituloSanitizado = sanitizeFilename(info.title);
    const nomeArquivo = `${tituloSanitizado}.mp4`;
    const caminhoArquivo = path.join(pastaLocal, nomeArquivo);

    console.log('Iniciando download para:', caminhoArquivo);

    // Baixar o vídeo
    await youtubedl(url, {
      output: caminhoArquivo,
      format: 'best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      noWarnings: true,
      noCheckCertificates: true,
      youtubeSkipDashManifest: true,
      extractFlat: false,
      writeInfoJson: false,
      writeDescription: false,
      writeThumbnail: false
    });

    // Verificar se o arquivo foi criado
    if (!fs.existsSync(caminhoArquivo)) {
      throw new Error('Arquivo não foi criado após o download');
    }

    const stats = fs.statSync(caminhoArquivo);
    const tamanhoArquivo = stats.size;
    const duracaoVideo = Math.floor(info.duration || 0);

    console.log('Download concluído. Tamanho:', tamanhoArquivo, 'Duração:', duracaoVideo);

    // Gerar URL relativa
    const videoUrl = `/uploads/${userId}/${id_pasta}/${nomeArquivo}`;

    // Salvar no banco de dados
    const { data, error } = await supabase
      .from('videos')
      .insert([
        {
          nome: nomeArquivo,
          filename: nomeArquivo,
          id_folder: parseInt(id_pasta),
          id_user: userId,
          url: videoUrl,
          tamanho: tamanhoArquivo,
          duracao: duracaoVideo,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar no banco:', error);
      // Remover arquivo se erro no banco
      if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
      }
      throw error;
    }

    console.log('Vídeo salvo no banco com sucesso');

    res.json({ 
      success: true,
      video: data,
      message: 'Vídeo baixado com sucesso!'
    });

  } catch (error) {
    console.error('Erro no download do vídeo:', error);
    
    let errorMessage = 'Erro ao processar download';
    
    if (error.message.includes('Video unavailable')) {
      errorMessage = 'Vídeo não disponível ou privado';
    } else if (error.message.includes('network')) {
      errorMessage = 'Erro de conexão. Verifique sua internet';
    } else if (error.message.includes('format')) {
      errorMessage = 'Formato de vídeo não suportado';
    } else if (error.message.includes('age')) {
      errorMessage = 'Vídeo com restrição de idade';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

export default router;