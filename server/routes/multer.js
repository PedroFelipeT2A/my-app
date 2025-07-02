import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import multer from 'multer'; // Importar multer

const router = express.Router();

// Configurar o multer para armazenamento de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'videos/'; // Diretório onde os vídeos serão armazenados
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Usar um nome de arquivo único ou sanitizar o nome original
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });