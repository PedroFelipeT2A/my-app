import express from 'express';
import cors from 'cors';
import path from 'path';

import playlistsRoutes from './routes/playlists.js';  
import videosRoutes from './routes/videos.js';
import foldersRoutes from './routes/folders.js';
import agendamentosRoutes from './routes/agendamentos.js';
import comerciaisRoutes from './routes/comerciais.js';
import downloadYoutubeRoutes from './routes/downloadyoutube.js';
import streamingRoutes from './routes/streaming.js';
import wowzaRoutes from './routes/wowza.js';
import serversRoutes from './routes/servers.js';
import logosRoutes from './routes/logos.js';
import transmissionSettingsRoutes from './routes/transmission-settings.js';
import ftpRoutes from './routes/ftp.js';
import espectadoresRoutes from './routes/espectadores.js';
import relayRoutes from './routes/relay.js';
import userSettingsRoutes from './routes/user-settings.js';

const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos - CORRIGIDO para funcionar com preview
app.use('/videos', express.static(path.resolve('videos')));
app.use('/uploads', express.static(path.resolve('server/uploads')));

// Middleware para logs de requisições de arquivos estáticos
app.use('/uploads', (req, res, next) => {
  console.log('Requisição de arquivo estático:', req.url);
  console.log('Caminho completo:', path.resolve('server/uploads', req.url.substring(1)));
  next();
});

app.use('/api/videos', videosRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/comerciais', comerciaisRoutes);
app.use('/api/downloadyoutube', downloadYoutubeRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/wowza', wowzaRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/logos', logosRoutes);
app.use('/api/transmission-settings', transmissionSettingsRoutes);
app.use('/api/ftp', ftpRoutes);
app.use('/api/espectadores', espectadoresRoutes);
app.use('/api/relay', relayRoutes);
app.use('/api/user-settings', userSettingsRoutes);

const port = 3001;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`Diretório de uploads: ${path.resolve('server/uploads')}`);
  console.log(`Arquivos estáticos servidos em: http://localhost:${port}/uploads/`);
});