  const express = require('express');
  const cors = require('cors');
  const path = require('path');
  const db = require('./config/database');


  // Importar rotas
  const authRoutes = require('./routes/auth');
  const foldersRoutes = require('./routes/folders');
  const videosRoutes = require('./routes/videos');
  const playlistsRoutes = require('./routes/playlists');
  const agendamentosRoutes = require('./routes/agendamentos');
  const comerciaisRoutes = require('./routes/comerciais');
  const downloadyoutubeRoutes = require('./routes/downloadyoutube');
  const espectadoresRoutes = require('./routes/espectadores');
  const streamingRoutes = require('./routes/streaming');
  const relayRoutes = require('./routes/relay');
  const logosRoutes = require('./routes/logos');
  const transmissionSettingsRoutes = require('./routes/transmission-settings');
  const ftpRoutes = require('./routes/ftp');
  const serversRoutes = require('./routes/servers');

  const app = express();
  const PORT = process.env.PORT || 3001;
  const isProduction = process.env.NODE_ENV === 'production';

  // Middlewares
  app.use(cors({
    origin: isProduction ? [
      'http://samhost.wcore.com.br',
      'https://samhost.wcore.com.br',
      'http://samhost.wcore.com.br:3000'
    ] : [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Servir arquivos estáticos do Wowza
  app.use('/content', express.static('/usr/local/WowzaStreamingEngine/content', {
    maxAge: '1h', // Cache por 1 hora
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Configurar headers CORS para vídeos
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Headers para cache de vídeos
      if (path.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', 'video/mp4');
      }
    }
  }));
  
  // Servir arquivos estáticos do frontend em produção
  if (isProduction) {
    app.use(express.static(path.join(__dirname, '../dist')));
    
    // Catch all handler: send back React's index.html file for SPA routing
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      }
    });
  }

  // Rotas da API
  app.use('/api/auth', authRoutes);
  app.use('/api/folders', foldersRoutes);
  app.use('/api/videos', videosRoutes);
  app.use('/api/playlists', playlistsRoutes);
  app.use('/api/agendamentos', agendamentosRoutes);
  app.use('/api/comerciais', comerciaisRoutes);
  app.use('/api/downloadyoutube', downloadyoutubeRoutes);
  app.use('/api/espectadores', espectadoresRoutes);
  app.use('/api/streaming', streamingRoutes);
  app.use('/api/relay', relayRoutes);
  app.use('/api/logos', logosRoutes);
  app.use('/api/transmission-settings', transmissionSettingsRoutes);
  app.use('/api/ftp', ftpRoutes);
  app.use('/api/servers', serversRoutes);

  // Rota de teste
  app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
  });

  // Rota de health check
  app.get('/api/health', async (req, res) => {
    try {
      const dbConnected = await db.testConnection();
      res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Middleware de tratamento de erros
  app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Arquivo muito grande' });
    }
    
    if (error.message.includes('Tipo de arquivo não suportado')) {
      return res.status(400).json({ error: 'Tipo de arquivo não suportado' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  // Rota 404
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // Iniciar servidor
  async function startServer() {
    try {
      // Testar conexão com banco
      const dbConnected = await db.testConnection();
      
      if (!dbConnected) {
        console.error('❌ Não foi possível conectar ao banco de dados');
        process.exit(1);
      }

      app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`🔧 API test: http://localhost:${PORT}/api/test`);
      });
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  startServer();