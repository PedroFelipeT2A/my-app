import express from 'express';
import cors from 'cors';

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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/videos', express.static('videos'));
app.use('/uploads', express.static('uploads'));

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

const port = 3001;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});