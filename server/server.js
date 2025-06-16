import express from 'express';
import cors from 'cors';

import playlistsRoutes from './routes/playlists.js';  
import videosRoutes from './routes/videos.js';
import foldersRoutes from './routes/folders.js';
import agendamentosRoutes from './routes/agendamentos.js';
import comerciaisRoutes from './routes/comerciais.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/videos', express.static('videos'));

app.use('/api/videos', videosRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/comerciais', comerciaisRoutes);

const port = 3001;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});