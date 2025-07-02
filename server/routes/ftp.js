import express from 'express';
import { supabaseAuthMiddleware } from '../supabaseClient.js';
import { Client } from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// Extensões de vídeo suportadas
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mpg', '.mpeg'];

// Função para verificar se é um arquivo de vídeo
function isVideoFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

// Função para conectar ao FTP e listar arquivos
async function connectAndList(ftpConfig, targetPath = '/') {
  const client = new Client();
  client.ftp.verbose = false;
  
  try {
    await client.access({
      host: ftpConfig.ip,
      port: ftpConfig.porta || 21,
      user: ftpConfig.usuario,
      password: ftpConfig.senha,
      secure: false
    });

    // Navegar para o diretório especificado
    if (targetPath !== '/') {
      await client.cd(targetPath);
    }

    const files = await client.list();
    
    const processedFiles = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type === 1 ? 'file' : 'directory',
      path: path.posix.join(targetPath, file.name),
      isVideo: file.type === 1 ? isVideoFile(file.name) : false
    }));

    client.close();

    return {
      success: true,
      files: processedFiles,
      currentPath: targetPath
    };
  } catch (error) {
    client.close();
    throw error;
  }
}

// Função recursiva para listar todos os vídeos de uma pasta
async function listAllVideosInDirectory(ftpConfig, directoryPath) {
  const client = new Client();
  client.ftp.verbose = false;
  const allVideos = [];
  
  try {
    await client.access({
      host: ftpConfig.ip,
      port: ftpConfig.porta || 21,
      user: ftpConfig.usuario,
      password: ftpConfig.senha,
      secure: false
    });

    async function scanDirectory(dirPath) {
      try {
        await client.cd(dirPath);
        const files = await client.list();
        
        for (const file of files) {
          const filePath = path.posix.join(dirPath, file.name);
          
          if (file.type === 1 && isVideoFile(file.name)) {
            // É um arquivo de vídeo
            allVideos.push({
              name: file.name,
              path: filePath,
              size: file.size,
              directory: dirPath
            });
          } else if (file.type === 2 && file.name !== '.' && file.name !== '..') {
            // É um diretório, escanear recursivamente
            await scanDirectory(filePath);
          }
        }
      } catch (error) {
        console.error(`Erro ao escanear diretório ${dirPath}:`, error.message);
      }
    }

    await scanDirectory(directoryPath);
    client.close();
    
    return allVideos;
  } catch (error) {
    client.close();
    throw error;
  }
}

// POST /api/ftp/connect - Conectar ao FTP e listar arquivos do diretório raiz
router.post('/connect', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { ip, usuario, senha, porta } = req.body;

    if (!ip || !usuario || !senha) {
      return res.status(400).json({
        success: false,
        error: 'IP, usuário e senha são obrigatórios'
      });
    }

    const ftpConfig = { ip, usuario, senha, porta: porta || 21 };
    const result = await connectAndList(ftpConfig, '/');

    res.json(result);
  } catch (error) {
    console.error('Erro ao conectar ao FTP:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao conectar ao FTP: ' + error.message
    });
  }
});

// POST /api/ftp/list - Listar arquivos de um diretório específico
router.post('/list', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { ip, usuario, senha, porta, path: targetPath } = req.body;

    if (!ip || !usuario || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Dados de conexão FTP são obrigatórios'
      });
    }

    const ftpConfig = { ip, usuario, senha, porta: porta || 21 };
    const result = await connectAndList(ftpConfig, targetPath || '/');

    res.json(result);
  } catch (error) {
    console.error('Erro ao listar diretório FTP:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar diretório: ' + error.message
    });
  }
});

// POST /api/ftp/scan-directory - Escanear pasta recursivamente para encontrar todos os vídeos
router.post('/scan-directory', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { ftpConnection, directoryPath } = req.body;

    if (!ftpConnection || !directoryPath) {
      return res.status(400).json({
        success: false,
        error: 'Dados de conexão FTP e caminho do diretório são obrigatórios'
      });
    }

    const videos = await listAllVideosInDirectory(ftpConnection, directoryPath);

    res.json({
      success: true,
      videos,
      totalVideos: videos.length
    });
  } catch (error) {
    console.error('Erro ao escanear diretório:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao escanear diretório: ' + error.message
    });
  }
});

// POST /api/ftp/migrate - Migrar arquivos do FTP para o sistema local
router.post('/migrate', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { ftpConnection, files, destinationFolder } = req.body;
    const userId = req.user.id;

    if (!ftpConnection || !files || !destinationFolder) {
      return res.status(400).json({
        success: false,
        error: 'Dados de conexão, arquivos e pasta de destino são obrigatórios'
      });
    }

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo selecionado para migração'
      });
    }

    // Verificar se a pasta de destino pertence ao usuário
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, nome')
      .eq('id', destinationFolder)
      .eq('id_user', userId)
      .single();

    if (folderError || !folder) {
      return res.status(404).json({
        success: false,
        error: 'Pasta de destino não encontrada ou sem permissão'
      });
    }

    // Criar diretório local se não existir
    const localDir = path.resolve(`uploads/${userId}/${destinationFolder}`);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const client = new Client();
    client.ftp.verbose = false;
    
    try {
      // Conectar ao FTP
      await client.access({
        host: ftpConnection.ip,
        port: ftpConnection.porta || 21,
        user: ftpConnection.usuario,
        password: ftpConnection.senha,
        secure: false
      });

      const migratedFiles = [];
      const errors = [];

      // Processar cada arquivo
      for (const filePath of files) {
        try {
          const fileName = path.basename(filePath);
          const localFilePath = path.join(localDir, fileName);

          console.log(`Baixando arquivo: ${filePath} para ${localFilePath}`);

          // Baixar arquivo do FTP
          await client.downloadTo(localFilePath, filePath);

          // Verificar se o arquivo foi baixado
          if (!fs.existsSync(localFilePath)) {
            throw new Error('Arquivo não foi baixado corretamente');
          }

          // Obter informações do arquivo
          const stats = fs.statSync(localFilePath);
          const fileSize = stats.size;

          // Obter duração do vídeo (se possível)
          let duration = 0;
          try {
            // Aqui você pode integrar com ffprobe para obter a duração
            // Por enquanto, vamos usar 0 como padrão
            duration = 0;
          } catch (durationError) {
            console.warn('Não foi possível obter duração do vídeo:', fileName);
          }

          // Salvar informações no banco de dados
          const videoUrl = `/uploads/${userId}/${destinationFolder}/${fileName}`;
          
          console.log('Salvando no banco:', {
            nome: fileName,
            id_folder: parseInt(destinationFolder),
            id_user: userId,
            url: videoUrl,
            tamanho: fileSize,
            duracao: duration,
            filename: fileName
          });

          const { data: videoData, error: videoError } = await supabase
            .from('videos')
            .insert([{
              nome: fileName,
              id_folder: parseInt(destinationFolder), // Usar id_folder
              id_user: userId,
              url: videoUrl,
              tamanho: fileSize,
              duracao: duration,
              filename: fileName
            }])
            .select()
            .single();

          if (videoError) {
            console.error('Erro ao salvar vídeo no banco:', videoError);
            errors.push(`Erro ao salvar ${fileName} no banco de dados: ${videoError.message}`);
            // Remover arquivo local se falhou ao salvar no banco
            if (fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
            }
          } else {
            console.log('Vídeo salvo com sucesso:', videoData);
            migratedFiles.push({
              fileName,
              localPath: localFilePath,
              size: fileSize,
              videoData
            });
          }
        } catch (fileError) {
          console.error(`Erro ao migrar arquivo ${filePath}:`, fileError);
          errors.push(`Erro ao migrar ${path.basename(filePath)}: ${fileError.message}`);
        }
      }

      client.close();

      if (migratedFiles.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Nenhum arquivo foi migrado com sucesso',
          details: errors
        });
      }

      res.json({
        success: true,
        message: `${migratedFiles.length} arquivo(s) migrado(s) com sucesso`,
        migratedFiles: migratedFiles.length,
        totalFiles: files.length,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (ftpError) {
      client.close();
      throw ftpError;
    }

  } catch (error) {
    console.error('Erro na migração FTP:', error);
    res.status(500).json({
      success: false,
      error: 'Erro durante a migração: ' + error.message
    });
  }
});

export default router;