import express from 'express';
import { supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

router.get('/test-auth', supabaseAuthMiddleware, (req, res) => {
  res.json({ message: 'Usuário autenticado com sucesso', user: req.user });
});

export default router;
