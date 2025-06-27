import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Configurar multer para upload de logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/logos/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// GET /api/logos - Listar logos do usuário
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('logos')
      .select('*')
      .eq('id_user', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar logos', details: err.message });
  }
});

// POST /api/logos - Upload de nova logo
router.post('/', supabaseAuthMiddleware, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const userId = req.user.id;
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da logo é obrigatório' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const url = `${baseUrl}/uploads/logos/${req.file.filename}`;

    const { data, error } = await supabase
      .from('logos')
      .insert([{
        id_user: userId,
        nome,
        url,
        tamanho: req.file.size,
        tipo_arquivo: req.file.mimetype,
        ativo: true
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    // Remover arquivo se houve erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro ao fazer upload da logo', details: err.message });
  }
});

// DELETE /api/logos/:id - Remover logo
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Buscar logo para obter o caminho do arquivo
    const { data: logo, error: fetchError } = await supabase
      .from('logos')
      .select('url')
      .eq('id', id)
      .eq('id_user', userId)
      .single();

    if (fetchError || !logo) {
      return res.status(404).json({ error: 'Logo não encontrada' });
    }

    // Remover do banco
    const { error } = await supabase
      .from('logos')
      .delete()
      .eq('id', id)
      .eq('id_user', userId);

    if (error) throw error;

    // Remover arquivo físico
    try {
      const filename = logo.url.split('/').pop();
      const filePath = path.join('uploads/logos/', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error('Erro ao remover arquivo:', fileError);
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover logo', details: err.message });
  }
});

export default router;